/**
 * Popup: pairing + activation controls.
 */

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

async function refresh() {
  const state = (await chrome.runtime.sendMessage({ type: "getState" })) as {
    pairing: { serverUrl: string; user: { name: string }; profiles: { profileName: string }[] } | null;
  };
  const pairView = $("pair-view");
  const pairedView = $("paired-view");
  if (state?.pairing) {
    pairView.style.display = "none";
    pairedView.style.display = "block";
    $("p-email").textContent = state.pairing.user.name || "Local vault";
    $("p-server").textContent = state.pairing.serverUrl.replace(/^https?:\/\//, "");
    $("p-profiles").textContent = String(state.pairing.profiles.length);
  } else {
    pairView.style.display = "block";
    pairedView.style.display = "none";
  }
}

$("pair").addEventListener("click", async () => {
  const status = $("pair-status");
  const server = ($("server") as HTMLInputElement).value.replace(/\/$/, "");
  const setStatus = (cls: string, text: string) => {
    status.style.display = "block";
    status.className = `status ${cls}`;
    status.textContent = text;
  };
  if (!server) {
    setStatus("err", "Enter the D-Vault server URL.");
    return;
  }
  setStatus("note", "Connecting to your vault…");
  $("pair").setAttribute("disabled", "true");
  const res = (await chrome.runtime.sendMessage({
    type: "pair",
    serverUrl: server,
    deviceName: `Chrome on ${navigator.platform || "this device"}`,
  })) as { ok: boolean; error?: string };
  $("pair").removeAttribute("disabled");
  if (res.ok) {
    setStatus("ok", "Connected. Close this popup and click the D icon on any form page.");
    setTimeout(refresh, 600);
  } else {
    setStatus("err", res.error ?? "Pairing failed.");
  }
});

$("unpair")?.addEventListener("click", async () => {
  await chrome.runtime.sendMessage({ type: "unpair" });
  refresh();
});

$("activate")?.addEventListener("click", async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab?.id) {
    await chrome.action.setBadgeText({ tabId: tab.id, text: "D" });
    await chrome.action.setBadgeBackgroundColor({ tabId: tab.id, color: "#2563EB" });
    try {
      await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["content.js"] });
      window.close();
    } catch {
      alert("Could not activate on this page (browser-internal pages block extensions).");
    }
  }
});

refresh();
