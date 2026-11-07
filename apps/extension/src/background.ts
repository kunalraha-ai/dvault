/**
 * D-Vault background service worker (Manifest V3).
 *
 * Security model:
 * - The ONLY entry point into a page is chrome.action.onClicked, which
 *   grants activeTab for that tab and injects the content script there.
 * - No content scripts are registered in the manifest: nothing ever runs on
 *   page load and no pages are inspected before explicit activation.
 * - This worker relays API calls (CORS-enabled, device-token authenticated)
 *   and captures screenshots ONLY when the user consents per save.
 */

import { getPairing, clearPairing, type StoredPairing } from "./store";chrome.runtime.onInstalled.addListener(() => {
  chrome.action.setBadgeText({ text: "" });
});

/** Explicit activation: toolbar click → activeTab + inject panel. */
chrome.action.onClicked.addListener(async (tab) => {
  if (!tab.id || !tab.url || /^(chrome|edge|about|chrome-extension):/i.test(tab.url)) {
    return;
  }
  const pairing = await getPairing();
  if (!pairing) {
    // open the popup-less flow: show pairing instructions
    chrome.tabs.create({ url: chrome.runtime.getURL("popup.html") });
    return;
  }
  await chrome.action.setBadgeText({ tabId: tab.id, text: "D" });
  await chrome.action.setBadgeBackgroundColor({ tabId: tab.id, color: "#2563EB" });
  try {
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ["content.js"],
    });
  } catch (e) {
    console.error("D-Vault: could not inject (page may block scripts)", e);
    await chrome.action.setBadgeText({ tabId: tab.id, text: "" });
  }
});

type PanelMessage =
  | { type: "getState" }
  | { type: "apiFetch"; path: string; init?: RequestInit }
  | { type: "voiceStt"; audioBase64: string; language: string }
  | { type: "captureVisibleTab" }
  | { type: "pair"; serverUrl: string; deviceName: string }
  | { type: "unpair" };

chrome.runtime.onMessage.addListener((msg: PanelMessage, _sender, sendResponse: (r: unknown) => void) => {
  (async () => {
    switch (msg.type) {
      case "getState": {
        const pairing = await getPairing();
        sendResponse({
          pairing: pairing
            ? { serverUrl: pairing.serverUrl, user: pairing.user, profiles: pairing.profiles }
            : null,
        });
        break;
      }
      case "voiceStt": {
        // Audio arrives as base64 (FormData doesn't survive chrome.runtime.sendMessage).
        // Reconstruct the FormData here in the service worker and send to the STT endpoint.
        const pairing = await getPairing();
        if (!pairing) {
          sendResponse({ ok: false, error: "Not paired" });
          break;
        }
        try {
          // decode base64 → bytes
          const binary = atob(msg.audioBase64);
          const bytes = new Uint8Array(binary.length);
          for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);

          // construct FormData with the audio blob
          const form = new FormData();
          form.append("audio", new Blob([bytes], { type: "audio/wav" }), "command.wav");
          form.append("language", msg.language || "en-IN");

          const res = await fetch(`${pairing.serverUrl}/api/voice/stt`, {
            method: "POST",
            headers: { "X-DVault-Device-Token": pairing.deviceToken },
            body: form,
          });
          const data = await res.json();
          sendResponse({ ok: res.ok, ...data });
        } catch (e) {
          sendResponse({ ok: false, error: e instanceof Error ? e.message : "Voice request failed" });
        }
        break;
      }
      case "apiFetch": {
        const pairing = await getPairing();
        if (!pairing) {
          sendResponse({ ok: false, status: 401, error: "Not paired" });
          break;
        }
        try {
          const res = await fetch(`${pairing.serverUrl}${msg.path}`, {
            ...msg.init,
            headers: {
              ...(msg.init?.headers as Record<string, string> | undefined),
              "X-DVault-Device-Token": pairing.deviceToken,
            },
          });
          const body = await res.text();
          sendResponse({ ok: res.ok, status: res.status, body });
        } catch (e) {
          sendResponse({ ok: false, status: 0, error: e instanceof Error ? e.message : "fetch failed" });
        }
        break;
      }
      case "captureVisibleTab": {
        // Only reachable from an explicit user action in the panel.
        try {
          const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
          if (!tab?.id) throw new Error("No active tab");
          const dataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, { format: "png" });
          sendResponse({ ok: true, dataUrl });
        } catch (e) {
          sendResponse({ ok: false, error: e instanceof Error ? e.message : "capture failed" });
        }
        break;
      }
      case "pair": {
        try {
          const res = await fetch(`${msg.serverUrl.replace(/\/$/, "")}/api/extension/pair`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ deviceName: msg.deviceName }),
          });
          const data = (await res.json()) as {
            ok?: boolean;
            deviceToken?: string;
            keyJwk?: JsonWebKey;
            user?: StoredPairing["user"];
            profiles?: StoredPairing["profiles"];
            error?: string;
          };
          if (!res.ok || !data.deviceToken || !data.keyJwk || !data.user) {
            sendResponse({ ok: false, error: data.error ?? `Pairing failed (${res.status})` });
            break;
          }
          const pairing: StoredPairing = {
            serverUrl: msg.serverUrl.replace(/\/$/, ""),
            deviceToken: data.deviceToken,
            keyJwk: data.keyJwk,
            user: data.user,
            profiles: data.profiles ?? [],
            pairedAt: new Date().toISOString(),
          };
          const { setPairing } = await import("./store");
          await setPairing(pairing);
          sendResponse({ ok: true, user: data.user });
        } catch (e) {
          sendResponse({ ok: false, error: e instanceof Error ? e.message : "Pairing failed" });
        }
        break;
      }
      case "unpair": {
        await clearPairing();
        sendResponse({ ok: true });
        break;
      }
    }
  })();
  return true; // async sendResponse
});
