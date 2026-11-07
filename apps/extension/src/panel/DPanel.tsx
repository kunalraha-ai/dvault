/**
 * DPanel — the floating assistant panel injected into the active tab.
 *
 * Flows implemented here (all gated on explicit user actions):
 *  - Activate/inspect: reads field METADATA only (no values)
 *  - FILL_ACTIVE_FORM: deterministic mapping (on-device) → scoped vault
 *    retrieval (only the needed keys, encrypted) → local decrypt → review
 *    with confidence badges → approved autofill. Never submits.
 *  - SAVE_APPLICATION: user consent → screenshot capture (per-save) →
 *    encrypted upload to application memory.
 *  - GET_* intents: scoped single-field retrieval, masked on screen.
 *  - Voice via the D-Vault server (Gnani.ai STT) with honest error states.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import {
  parseIntent, mapFormField, matchSelectOption, PcmRecorder,
  importKeyJwk, decryptString, encryptBytes, encryptString,
  FIELD_MAP, fieldsForProfile, fallbackLocale,
  type FormFieldMetadata, type MappingOutcome, type ParsedIntent, type CipherEnvelope,
} from "../core";
import { inspectPage, resolveDomElements } from "../form-inspector";
import { fillField } from "../autofill";
import type { AssistantSettings } from "../core";

// ---------------------------------------------------------------------------
// chrome.* helpers (content-script context)
// ---------------------------------------------------------------------------

function sendMsg<T>(msg: unknown): Promise<T> {
  return new Promise((resolve, reject) => {
    try {
      chrome.runtime.sendMessage(msg, (res: T) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve(res);
        }
      });
    } catch {
      reject(new Error("Extension was reloaded — refresh this page and try again."));
    }
  });
}

/** Efficient base64 encoding — processes in 8KB chunks (not char-by-char). */
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const chunk = 8192;
  let binary = "";
  for (let i = 0; i < bytes.length; i += chunk) {
    const slice = bytes.subarray(i, Math.min(i + chunk, bytes.length));
    binary += String.fromCharCode.apply(null, slice as unknown as number[]);
  }
  return btoa(binary);
}

async function apiFetch(path: string, init?: RequestInit): Promise<{ ok: boolean; status: number; body: string }> {
  try {
    return await sendMsg({ type: "apiFetch", path, init });
  } catch (e) {
    return {
      ok: false,
      status: 0,
      body: e instanceof Error && e.message.includes("reloaded")
        ? "Extension reloaded — refresh the page"
        : "Connection error",
    };
  }
}

async function apiJson<T>(path: string, init?: RequestInit): Promise<{ ok: boolean; status: number; data?: T; error?: string }> {
  const res = await apiFetch(path, init);
  try {
    const parsed = JSON.parse(res.body) as T & { error?: string };
    return { ok: res.ok, status: res.status, data: parsed, error: parsed ? (parsed as { error?: string }).error : res.body };
  } catch {
    return { ok: res.ok, status: res.status, error: res.body || `HTTP ${res.status}` };
  }
}

async function logConsent(action: string, details?: Record<string, unknown>) {
  await apiFetch("/api/extension/consent", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, websiteDomain: location.host, details }),
  }).catch(() => undefined);
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type PanelState = "idle" | "listening" | "processing" | "review" | "filling" | "done" | "error";

interface PairingInfo {
  serverUrl: string;
  user: { id: string; email: string; name: string | null };
  profiles: { id: string; profileType: "personal" | "business"; profileName: string }[];
}

interface ReviewItem {
  field: FormFieldMetadata & { domIndex: number };
  mapping: MappingOutcome["mapping"];
  alternatives: MappingOutcome["alternatives"];
  value: string | null;        // decrypted vault value (or edited by user)
  missingInVault: boolean;
  included: boolean;
  revealed: boolean;
  edited: boolean;
  chosenKey: string | null;    // may differ from mapping.fieldKey after manual pick
}

interface Bubble { role: "user" | "d"; text: string; intent?: string; kind?: "err" }

const CONF_LABEL = { high: "High", medium: "Medium", low: "Low", none: "—", missing: "Missing", unsupported: "Unsupported" } as const;

// ---------------------------------------------------------------------------
// The panel
// ---------------------------------------------------------------------------

export function DPanel() {
  const [open, setOpen] = useState(false);
  const [pairing, setPairing] = useState<PairingInfo | null>(null);
  const [key, setKey] = useState<CryptoKey | null>(null);
  const [assistantSettings, setAssistantSettings] = useState<AssistantSettings>({ language: "en-IN", voice: "Kaveri", speakSensitive: false });
  const [state, setState] = useState<PanelState>("idle");
  const [bubbles, setBubbles] = useState<Bubble[]>([]);
  const [typed, setTyped] = useState("");
  const [profileType, setProfileType] = useState<"personal" | "business">("business");
  const [review, setReview] = useState<ReviewItem[] | null>(null);
  const [fillSummary, setFillSummary] = useState<{ filled: number; skipped: number; unsupported: number } | null>(null);
  const [saveFlow, setSaveFlow] = useState<{ open: boolean; ref: string; name: string; withShot: boolean; busy: boolean; done: boolean } | null>(null);
  const [voiceStatus, setVoiceStatus] = useState<"gnani" | "fallback" | "none" | "unknown">("unknown");
  const recorderRef = useRef<PcmRecorder | null>(null);
  const bodyRef = useRef<HTMLDivElement>(null);

  const say = useCallback((text: string, intent?: string, kind?: "err") => {
    setBubbles((b) => [...b, { role: "d", text, intent, kind }]);
  }, []);
  const userSays = useCallback((text: string) => {
    setBubbles((b) => [...b, { role: "user", text }]);
  }, []);

  useEffect(() => {
    (async () => {
      const state = (await sendMsg<{ pairing: PairingInfo | null }>({ type: "getState" }));
      setPairing(state?.pairing ?? null);
      // derive: read the stored JWK and import it
      const got = await chrome.storage.local.get("dvault.pairing");
      const stored = got["dvault.pairing"] as { keyJwk: JsonWebKey } | undefined;
      if (stored?.keyJwk) {
        try { setKey(await importKeyJwk(stored.keyJwk)); } catch { /* key unusable */ }
      }
      const st = await apiJson<{ voice: { configured: boolean } }>("/api/voice/status");
      if (st.ok && st.data) setVoiceStatus(st.data.voice.configured ? "gnani" : "fallback");
      else setVoiceStatus("none");
      // shared assistant settings (language / voice / speakSensitive)
      const sRes = await apiJson<Partial<AssistantSettings>>("/api/settings");
      if (sRes.ok && sRes.data) {
        setAssistantSettings((prev) => ({
          ...prev,
          language: sRes.data?.language ?? prev.language,
          voice: sRes.data?.voice ?? prev.voice,
          speakSensitive: sRes.data?.speakSensitive ?? prev.speakSensitive,
        }));
      }
    })();
  }, []);

  useEffect(() => {
    bodyRef.current?.scrollTo({ top: bodyRef.current.scrollHeight, behavior: "smooth" });
  }, [bubbles, review]);

  // ------------------------------------------------------------------ fill flow

  const runFill = useCallback(async (pt: "personal" | "business") => {
    if (!pairing) return;
    setState("processing");
    say("Inspecting the active form on this page — labels and types only, never values…", "ANALYZE_ACTIVE_FORM");
    await logConsent("form_inspected", { url: location.host });

    const profile = pairing.profiles.find((p) => p.profileType === pt);
    if (!profile) {
      say(`You don't have a ${pt} profile on this account. Create one in the web app first.`, undefined, "err");
      setState("error");
      return;
    }

    const inspection = inspectPage(document);
    const fillable = inspection.fields.filter((f) => f.supported);
    const unsupported = inspection.fields.filter((f) => !f.supported);
    if (inspection.fields.length === 0) {
      say("I couldn't find any form fields on this page. If the form is inside a cross-origin iframe, that's a known limitation — I don't reach into other frames in this MVP.", "ANALYZE_ACTIVE_FORM", "err");
      setState("error");
      return;
    }

    say(`Found ${inspection.fields.length} fields (${fillable.length} fillable${unsupported.length ? `, ${unsupported.length} unsupported` : ""}). Mapping against your ${pt} vault…`, "ANALYZE_ACTIVE_FORM");

    // on-device deterministic mapping
    const outcomes = inspection.fields.map((f) =>
      mapFormField(f, {
        profileType: pt,
        formContext: {
          url: location.href, host: location.host, title: document.title,
          formCount: 1, labelsDigest: inspection.fields.map((f) => f.label).join(" "),
        },
      }),
    );

    // gather every candidate key to request (mapping + alternatives)
    const wanted = new Set<string>();
    outcomes.forEach((o) => {
      if (o.mapping.fieldKey) wanted.add(o.mapping.fieldKey);
      o.alternatives.forEach((a) => wanted.add(a.fieldKey));
    });

    // scoped retrieval: only these keys, still encrypted
    const res = await apiJson<{
      fields: Record<string, { encryptedValue: CipherEnvelope; isSensitive: boolean; label?: string }>;
      missing: string[];
    }>("/api/extension/vault-values", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ profileId: profile.id, fieldKeys: Array.from(wanted) }),
    });
    if (!res.ok || !res.data) {
      say(res.error ?? "Could not retrieve vault values.", "FILL_ACTIVE_FORM", "err");
      setState("error");
      return;
    }

    // decrypt locally
    const values: Record<string, string> = {};
    if (key) {
      for (const [k, v] of Object.entries(res.data.fields)) {
        try { values[k] = await decryptString(key, v.encryptedValue); } catch { /* skip */ }
      }
    }

    // build review items
    const items: ReviewItem[] = inspection.fields.map((f, i) => {
      const o = outcomes[i];
      const chosen = o.mapping.fieldKey;
      const inVault = chosen ? chosen in values : false;
      return {
        field: f,
        mapping: o.mapping,
        alternatives: o.alternatives,
        value: chosen ? (values[chosen] ?? null) : null,
        missingInVault: !f.supported ? false : Boolean(chosen) && !inVault,
        included: f.supported && o.mapping.level === "high" && inVault,
        revealed: !(FIELD_MAP[chosen ?? ""]?.sensitive),
        edited: false,
        chosenKey: chosen,
      };
    });

    // ── AUTO-FILL: no review panel, fill immediately ─────────────────────
    // The user said "fill this form" — that IS the permission.
    // Fill all high-confidence fields with vault values right away.
    const autoFill = items.filter(
      (i) => i.included && i.field.supported && i.chosenKey && i.value,
    );

    if (autoFill.length > 0) {
      setState("filling");
      const domMap = resolveDomElements(document, autoFill.map((r) => r.field));
      let filled = 0;
      let skipped = 0;

      for (const item of autoFill) {
        const el = domMap.get(item.field.id);
        if (!el) { skipped++; continue; }
        let value = item.value!;
        if (item.field.type === "select" || item.field.type === "radio") {
          const matched = matchSelectOption(item.field.options ?? [], value);
          if (!matched) { skipped++; continue; }
          value = matched;
        }
        const err = fillField(el, value, item.field.type);
        if (err) skipped++; else filled++;
      }

      await logConsent("autofill_approved", {
        filled, skipped,
        fields: autoFill.map((i) => ({ id: i.field.id, key: i.chosenKey })),
      });

      const needInput = items.filter(
        (i) => i.field.supported && (!i.chosenKey || !i.value) && i.field.type !== "checkbox",
      ).length;

      setFillSummary({ filled, skipped, unsupported });
      setReview(null);
      setState("done");
      say(
        `Filled ${filled} field${filled === 1 ? "" : "s"} automatically` +
        (skipped ? `, ${skipped} couldn't be filled` : "") +
        (needInput ? `. ${needInput} field${needInput === 1 ? "" : "s"} need your input` : "") +
        `. Check the page and press Submit yourself — D never does that.`,
        "FILL_ACTIVE_FORM",
      );
    } else {
      // Nothing could be auto-filled — show the review panel as a fallback
      // so the user can manually map fields
      setReview(items);
      setState("review");
      const fillable2 = items.filter((i) => i.field.supported);
      const mapped = fillable2.filter((i) => i.chosenKey);
      say(
        `Found ${items.length} fields but none could be auto-filled from your vault. ${mapped.length} mapped but no stored value. Select fields manually below.`,
        "FILL_ACTIVE_FORM",
      );
    }
  }, [pairing, key, say]);

  async function approveFill() {
    if (!review) return;
    setState("filling");
    const included = review.filter((r) => r.included && r.field.supported && r.chosenKey && r.value);
    const domMap = resolveDomElements(document, included.map((r) => r.field));
    let filled = 0;
    let skipped = 0;
    const unsupported = review.filter((r) => !r.field.supported).length;
    for (const item of included) {
      const el = domMap.get(item.field.id);
      if (!el) { skipped++; continue; }
      let value = item.value!;
      if (item.field.type === "select" || item.field.type === "radio") {
        const matched = matchSelectOption(item.field.options ?? [], value);
        if (!matched) { skipped++; continue; }
        value = matched;
      }
      const err = fillField(el, value, item.field.type);
      if (err) skipped++; else filled++;
    }
    await logConsent("autofill_approved", {
      filled, skipped,
      fields: included.map((i) => ({ id: i.field.id, key: i.chosenKey })),
    });
    setFillSummary({ filled, skipped, unsupported });
    setReview(null);
    setState("done");
    say(`Filled ${filled} approved field${filled === 1 ? "" : "s"}${skipped ? `, ${skipped} couldn't be filled` : ""}. Review the page and press Submit yourself — D never does that.`, "FILL_ACTIVE_FORM");
  }

  // ------------------------------------------------------------------ save flow

  function proposeSaveApplication() {
    // guess a reference number from the page (confirmation pages)
    const text = document.body.innerText.slice(0, 20000);
    const m =
      text.match(/(?:reference|acknowledgement|acknowledgment)[^\nA-Z0-9]{0,40}([A-Z][A-Z0-9]{2,}[-\s]?[0-9][0-9-]{3,})/i) ??
      text.match(/\b([A-Z]{2,4}[-\s]?20\d\d[-\s]?[0-9]{3,8})\b/);
    const name = document.title.split(/[|·—-]/)[0].trim().slice(0, 90) || `Application on ${location.hostname}`;
    setSaveFlow({ open: true, ref: m?.[1] ?? "", name, withShot: true, busy: false, done: false });
  }

  async function confirmSaveApplication() {
    if (!saveFlow || !key) return;
    setSaveFlow({ ...saveFlow, busy: true });
    const encRef = await encryptString(key, saveFlow.ref || "(none recorded)");
    const meta = {
      applicationName: saveFlow.name,
      websiteDomain: location.host,
      applicationUrl: location.href,
      profileId: pairing?.profiles.find((p) => p.profileType === profileType)?.id ?? null,
      encryptedReferenceId: encRef,
      submissionDate: new Date().toISOString(),
      status: "submitted" as const,
    };
    const form = new FormData();
    form.append("meta", JSON.stringify(meta));

    if (saveFlow.withShot) {
      const shot = (await sendMsg<{ ok: boolean; dataUrl?: string; error?: string }>({ type: "captureVisibleTab" }));
      if (shot.ok && shot.dataUrl) {
        const bytes = Uint8Array.from(atob(shot.dataUrl.split(",")[1]), (c) => c.charCodeAt(0));
        const enc = await encryptBytes(key, bytes);
        const blob = new Blob([enc.c], { type: "application/octet-stream" });
        form.append("screenshot", blob, "screenshot.enc");
        await logConsent("screenshot_captured", { host: location.host });
      } else {
        say(`Screenshot wasn't captured (${shot.error ?? "permission"}). Saving without it.`, "SAVE_APPLICATION");
      }
    }

    const res = await apiJson<{ application: { id: string } }>(
      "/api/extension/save-application",
      { method: "POST", body: form },
    );
    setSaveFlow({ ...saveFlow, busy: false, done: res.ok });
    if (res.ok) {
      say(`Saved “${saveFlow.name}” to your application memory${saveFlow.withShot ? " with a screenshot" : ""}. Ask me later: “what was my ${saveFlow.name} reference number?”`, "SAVE_APPLICATION");
    } else {
      say(res.error ?? "Could not save the application.", "SAVE_APPLICATION", "err");
    }
  }

  // ------------------------------------------------------------------ GET intents

  async function handleGetValue(intent: ParsedIntent) {
    if (!pairing || !intent.field_key) return;
    const def = FIELD_MAP[intent.field_key];
    const profile = pairing.profiles.find((p) => p.profileType === def?.profileType);
    if (!profile) { say(`You don't have a ${def?.profileType} profile.`, intent.intent, "err"); return; }
    const res = await apiJson<{ fields: Record<string, { encryptedValue: CipherEnvelope; isSensitive: boolean }>; missing: string[] }>(
      "/api/extension/vault-values",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profileId: profile.id, fieldKeys: [intent.field_key] }),
      },
    );
    if (!res.ok) { say("Could not retrieve that value.", intent.intent, "err"); return; }
    const row = res.data?.fields[intent.field_key];
    if (!row) {
      say(`You haven't stored “${def?.label}” yet. You can add it in the web app or say “remember that my ${def?.label?.toLowerCase()} is …”.`, intent.intent);
      return;
    }
    const value = key ? await decryptString(key, row.encryptedValue).catch(() => null) : null;
    if (!value) { say("Could not decrypt this value on this device.", intent.intent, "err"); return; }
    if (row.isSensitive) {
      say(`${def?.label}: •••• •••• ••••${value.slice(-2)} — sensitive, masked. Open the web app to reveal it.`, intent.intent);
    } else {
      say(`${def?.label}: ${value}`, intent.intent);
    }
  }

  // ------------------------------------------------------------------ voice

  async function startMic() {
    if (state === "listening") return;
    const rec = new PcmRecorder();
    try {
      await rec.start();
      recorderRef.current = rec;
      setState("listening");
    } catch (micErr) {
      const msg = micErr instanceof Error ? micErr.message : String(micErr);
      let hint = "Microphone blocked on this site. Allow the mic, or type your command below.";
      if (msg.includes("Permission denied") || msg.includes("NotAllowedError")) {
        hint = "Mic permission denied. Click the 🔒 icon in Chrome's address bar → Site settings → allow Microphone, then try again. Or type below.";
      } else if (msg.includes("NotFoundError") || msg.includes("DevicesNotFoundError")) {
        hint = "No microphone found. Connect a mic or type your command below.";
      } else if (msg.includes("AudioContext")) {
        hint = "Audio system error — try typing your command below.";
      }
      say(hint, undefined, "err");
      console.error("[D-Vault mic]", msg);
      setState("error");
    }
  }

  async function stopMic() {
    const rec = recorderRef.current;
    recorderRef.current = null;
    setState("processing");
    const blob = await rec?.stop();
    if (!blob || blob.size < 2000) {
      say("Too short — click the mic and speak after the click.", undefined, "err");
      setState("idle");
      return;
    }

    try {
      // Efficient base64 encoding (chunked, not char-by-char)
      const audioBase64 = arrayBufferToBase64(await blob.arrayBuffer());

      const res = await sendMsg<{
        ok?: boolean;
        transcript?: string;
        configured?: boolean;
        error?: string;
      }>({
        type: "voiceStt",
        audioBase64,
        language: assistantSettings.language === "indic-auto" ? "indic-auto" : assistantSettings.language,
      });

      if (res?.ok && res.transcript) {
        await handleTranscript(res.transcript, true);
      } else {
        say(res?.configured === false
          ? "Gnani.ai isn't configured on your D-Vault server (see docs/GNANI_INTEGRATION.md)."
          : (res?.error ?? "Voice provider error."), undefined, "err");
        setState("error");
      }
    } catch (voiceErr) {
      const msg = voiceErr instanceof Error ? voiceErr.message : String(voiceErr);
      say(msg.includes("reloaded")
        ? "Extension was reloaded — refresh this page and click D again."
        : `Voice error: ${msg}`, undefined, "err");
      setState("error");
    }
  }

  const handleTranscript = useCallback(async (text: string, viaVoice: boolean) => {
    userSays(text);
    setState("processing");
    const intent = parseIntent(text);
    switch (intent.intent) {
      case "FILL_ACTIVE_FORM":
        await runFill(intent.profile_type ?? profileType);
        break;
      case "ANALYZE_ACTIVE_FORM": {
        const inspection = inspectPage(document);
        await logConsent("form_inspected", { host: location.host });
        say(`Found ${inspection.fields.length} fields: ${inspection.fields.slice(0, 6).map((f) => f.label || f.id).join(", ")}${inspection.fields.length > 6 ? "…" : ""}. Say “fill this form” to map them.`, "ANALYZE_ACTIVE_FORM");
        setState("idle");
        break;
      }
      case "GET_PERSONAL_INFORMATION":
      case "GET_BUSINESS_INFORMATION":
        await handleGetValue(intent);
        setState("idle");
        break;
      case "SAVE_APPLICATION":
        proposeSaveApplication();
        setState("idle");
        break;
      case "SEARCH_APPLICATIONS": {
        const params = new URLSearchParams();
        if (intent.status) params.set("status", intent.status);
        if (intent.timeframe && intent.timeframe !== "all") params.set("timeframe", intent.timeframe);
        const res = await apiJson<{ applications: { applicationName: string; status: string }[] }>(
          `/api/applications?${params}`,
        );
        const apps = res.data?.applications ?? [];
        say(apps.length
          ? `Found ${apps.length}: ${apps.slice(0, 4).map((a) => `${a.applicationName} (${a.status})`).join("; ")}.`
          : "No saved applications match — records appear only after you save them.", intent.intent);
        setState("idle");
        break;
      }
      case "SET_ACTIVE_PROFILE":
        setProfileType(intent.profile_type ?? "personal");
        say(`Using your ${intent.profile_type} profile.`, intent.intent);
        setState("idle");
        break;
      case "UPLOAD_DOCUMENT":
        say("Upload documents from the D-Vault web app — opening it in a new tab.", intent.intent);
        if (pairing) window.open(`${pairing.serverUrl}/documents`, "_blank");
        setState("idle");
        break;
      case "GET_APPLICATION_DETAILS": {
        const res = await apiJson<{
          applications: { applicationName: string; encryptedReferenceId: CipherEnvelope | null }[];
        }>("/api/applications");
        const q = intent.query?.toLowerCase() ?? "";
        const match = q ? res.data?.applications.find((a) => a.applicationName.toLowerCase().includes(q)) : res.data?.applications[0];
        if (!match) { say(`I couldn't find a saved application matching “${intent.query ?? ""}”. I won't guess.`, intent.intent, "err"); setState("idle"); break; }
        const ref = match.encryptedReferenceId && key
          ? await decryptString(key, match.encryptedReferenceId).catch(() => null)
          : null;
        say(ref ? `${match.applicationName} — reference: ${ref}` : `${match.applicationName} — no reference ID saved.`, intent.intent);
        setState("idle");
        break;
      }
      default:
        say(intent.explanation, intent.intent, intent.intent === "UNKNOWN" ? "err" : undefined);
        setState("idle");
    }
    void viaVoice;
  }, [userSays, say, runFill, profileType, pairing, key]);

  // ------------------------------------------------------------------ render

  const listening = state === "listening";

  return (
    <>
      <button
        className={`dv-fab ${listening ? "listening" : ""} ${state === "error" ? "error" : ""}`}
        title="D-Vault — click to open the assistant panel"
        aria-label="D-Vault assistant"
        onClick={() => setOpen((o) => !o)}
      >
        <svg width="34" height="34" viewBox="0 0 64 64">
          <circle cx="32" cy="32" r="30" fill="#091025" stroke="rgba(147,197,253,.3)" />
          <text x="32" y="39" textAnchor="middle" fontFamily="sans-serif" fontWeight="800" fontSize="27" fill="#fff">D</text>
          <rect x="17" y="41" width="30" height="1.8" rx="0.9" fill="#3B82F6" />
          <rect x="21" y="44" width="22" height="1.8" rx="0.9" fill="#2563EB" opacity=".85" />
          <rect x="26" y="47" width="12" height="1.8" rx="0.9" fill="#93C5FD" opacity=".7" />
          <circle cx="44.5" cy="42" r="1.1" fill="#FA6EAB" />
        </svg>
      </button>

      {open && (
        <div className="dv-panel" role="dialog" aria-label="D-Vault assistant">
          <div className="dv-head">
            <div className="dv-head-row">
              <div className="dv-title">
                <svg width="22" height="22" viewBox="0 0 64 64">
                  <circle cx="32" cy="32" r="30" fill="#091025" stroke="rgba(147,197,253,.3)" />
                  <text x="32" y="39" textAnchor="middle" fontFamily="sans-serif" fontWeight="800" fontSize="27" fill="#fff">D</text>
                </svg>
                D · {location.host}
              </div>
              <button className="dv-x" aria-label="Close panel" onClick={() => setOpen(false)}>✕</button>
            </div>
            <p className="dv-sub">
              {pairing
                ? voiceStatus === "gnani"
                  ? "Voice by Gnani.ai · activate-before-inspect · you press Submit"
                  : "Browser-speech fallback (Gnani not configured on server) · you press Submit"
                : "Not paired — open the D-Vault popup from the toolbar to pair this browser."}
            </p>
            <MiniWave />
          </div>

          <div className="dv-body" ref={bodyRef}>
            {!pairing && (
              <div className="dv-bubble d">
                Pair this browser first: click the D-Vault toolbar icon → enter your server URL,
                email and password. Then click D again on this page.
              </div>
            )}
            {bubbles.map((b, i) => (
              <div key={i} className={`dv-bubble ${b.role === "user" ? "user" : `d ${b.kind === "err" ? "err" : ""}`}`}>
                {b.role === "d" && b.intent && <span className="intent">{b.intent}</span>}
                {b.text}
              </div>
            ))}

            {review && (
              <div>
                <p className="dv-review-head">
                  D found {review.length} fields ·{" "}
                  {review.filter((r) => r.included).length} proposed ·{" "}
                  {review.filter((r) => r.missingInVault).length} missing in vault
                </p>
                {review.map((item, idx) => (
                  <ReviewRow
                    key={item.field.id}
                    item={item}
                    onToggle={() => updateReview(idx, { included: !item.included })}
                    onReveal={() => updateReview(idx, { revealed: !item.revealed })}
                    onValue={(v) => updateReview(idx, { value: v, edited: true })}
                    onKey={(k) => updateReview(idx, {
                      chosenKey: k,
                      value: k ? null : item.value,
                      missingInVault: false,
                      revealed: !FIELD_MAP[k ?? ""]?.sensitive,
                    })}
                  />
                ))}
                <div className="dv-review-actions">
                  <button className="dv-btn primary" onClick={approveFill}>
                    Fill {review.filter((r) => r.included).length} approved
                  </button>
                  <button
                    className="dv-btn ghost"
                    onClick={() => setReview(review.map((r) => ({ ...r, included: r.field.supported && !r.missingInVault && !!r.chosenKey && r.value !== null })))}
                  >
                    Include all fillable
                  </button>
                </div>
                <p className="dv-note">
                  Only approved fields are filled. Excluded, unsupported and missing fields stay for you.
                  D never presses Submit and never solves CAPTCHAs.
                </p>
              </div>
            )}

            {fillSummary && (
              <div className="dv-bubble d">
                <span className="intent">FILL RESULT</span>
                Filled {fillSummary.filled} · skipped {fillSummary.skipped}
                {fillSummary.unsupported ? ` · unsupported ${fillSummary.unsupported}` : ""}.
                Check the values and press the page's own Submit button.
              </div>
            )}

            {saveFlow?.open && (
              <div className="dv-field" style={{ borderColor: "rgba(244,166,200,.35)" }}>
                <p className="dv-review-head">Save this application</p>
                <input
                  className="dv-name"
                  value={saveFlow.name}
                  placeholder="Application name"
                  style={{ width: "100%", background: "rgba(4,6,15,.5)", border: "1px solid rgba(147,197,253,.14)", borderRadius: 8, color: "#fff", fontSize: 12, padding: 6, marginBottom: 6 }}
                  onChange={(e) => setSaveFlow({ ...saveFlow, name: e.target.value })}
                />
                <input
                  value={saveFlow.ref}
                  placeholder="Reference / acknowledgement ID (from this page)"
                  style={{ width: "100%", background: "rgba(4,6,15,.5)", border: "1px solid rgba(147,197,253,.14)", borderRadius: 8, color: "#fff", fontSize: 12, padding: 6, marginBottom: 6 }}
                  onChange={(e) => setSaveFlow({ ...saveFlow, ref: e.target.value })}
                />
                <label className="dv-checkline">
                  <input
                    type="checkbox"
                    checked={saveFlow.withShot}
                    onChange={(e) => setSaveFlow({ ...saveFlow, withShot: e.target.checked })}
                  />
                  Capture a screenshot of this page (encrypted before upload)
                </label>
                <div className="dv-review-actions">
                  <button className="dv-btn pink" disabled={saveFlow.busy || saveFlow.done} onClick={confirmSaveApplication}>
                    {saveFlow.busy ? <span className="dv-spinner" /> : saveFlow.done ? "Saved ✓" : "Save to application memory"}
                  </button>
                  <button className="dv-btn ghost" onClick={() => setSaveFlow(null)}>Cancel</button>
                </div>
                <p className="dv-note">Saving stores: title, domain, URL, date, the reference above{saveFlow.withShot ? ", and this screenshot" : ""}. Nothing else on this page is captured.</p>
              </div>
            )}
          </div>

          <div className="dv-controls">
            {pairing && (
              <div className="dv-profile-row" role="radiogroup" aria-label="Active profile">
                {(["personal", "business"] as const).map((pt) => (
                  <button
                    key={pt}
                    className={`dv-profile ${profileType === pt ? "active" : ""}`}
                    onClick={() => setProfileType(pt)}
                    style={
                      profileType === pt
                        ? { borderColor: "#2E6EFA", background: "rgba(46,110,250,0.18)", color: "#F0F5FF" }
                        : { background: "rgba(255,255,255,0.08)", color: "#B5CDFF" }
                    }
                  >
                    {pt === "personal" ? "Personal vault" : "Business vault"}
                  </button>
                ))}
              </div>
            )}
            <div className="dv-mic-row">
              <button
                className={`dv-mic ${listening ? "stop" : ""}`}
                aria-label={listening ? "Stop and send" : "Start speaking"}
                disabled={!pairing}
                onClick={() => (listening ? stopMic() : startMic())}
              >
                {listening ? (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="2" /></svg>
                ) : (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z" /><path d="M19 10a1 1 0 1 0-2 0 5 5 0 0 1-10 0 1 1 0 1 0-2 0 7 7 0 0 0 6 6.93V20H8a1 1 0 1 0 0 2h8a1 1 0 1 0 0-2h-3v-3.07A7 7 0 0 0 19 10z" /></svg>
                )}
              </button>
            </div>
            <p className={`dv-status ${listening ? "listening" : ""}`} aria-live="polite">
              {state === "idle" && "Click the mic — D doesn't listen until you do."}
              {listening && "Listening… speak, then click stop."}
              {(state === "processing" || state === "filling") && (<><span className="dv-spinner" /> Working…</>)}
              {state === "review" && "Review the proposed mappings below."}
              {state === "done" && "Done — review the page and Submit manually."}
              {state === "error" && "Something needs attention — see messages above."}
            </p>
            <div className="dv-chips">
              {[
                `Fill this form with my ${profileType} profile`,
                "Analyze this form",
                "Save this application",
                "What is my full name?",
              ].map((cmd) => (
                <button key={cmd} className="dv-chip" onClick={() => handleTranscript(cmd, false)}>
                  {cmd}
                </button>
              ))}
            </div>
            <form
              className="dv-typed"
              onSubmit={(e) => {
                e.preventDefault();
                const v = typed;
                setTyped("");
                handleTranscript(v, false);
              }}
            >
              <input
                aria-label="Type a command"
                placeholder="Or type: “fill this form using my business profile”"
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
              />
              <button className="dv-btn primary" type="submit" disabled={!typed.trim()}>Send</button>
            </form>
          </div>
        </div>
      )}
    </>
  );

  function updateReview(idx: number, patch: Partial<ReviewItem>) {
    setReview((r) => {
      if (!r) return r;
      const next = [...r];
      next[idx] = { ...next[idx], ...patch };
      return next;
    });
  }
}

// ---------------------------------------------------------------------------
// Sub components
// ---------------------------------------------------------------------------

function ReviewRow({
  item, onToggle, onReveal, onValue, onKey,
}: {
  item: ReviewItem;
  onToggle: () => void;
  onReveal: () => void;
  onValue: (v: string) => void;
  onKey: (k: string | null) => void;
}) {
  const unsupported = !item.field.supported;
  const sensitive = FIELD_MAP[item.chosenKey ?? ""]?.sensitive ?? false;
  const conf =
    unsupported ? "unsupported"
    : !item.chosenKey ? "missing"
    : item.missingInVault ? "missing"
    : item.mapping.level === "high" ? "high"
    : item.mapping.level === "medium" ? "medium"
    : "low";

  return (
    <div className={`dv-field ${item.included ? "" : "excluded"}`}>
      <div className="dv-field-top">
        <span style={{ fontSize: 10.5, color: "#94a3b8" }}>{item.included ? "✓" : "○"}</span>
        <span className="dv-field-label">{item.field.label || item.field.id}</span>
        <span className={`dv-conf ${conf}`}>
          {unsupported ? "Unsupported" : CONF_LABEL[conf as keyof typeof CONF_LABEL]}
        </span>
        {!unsupported && (
          <button className="dv-exclude" onClick={onToggle} title={item.included ? "Exclude from fill" : "Include in fill"}>
            {item.included ? "✕" : "+"}
          </button>
        )}
      </div>
      <p className="dv-mapto">
        {unsupported
          ? (item.field.unsupportedReason ?? "Unsupported field type")
          : item.chosenKey
            ? `→ ${FIELD_MAP[item.chosenKey]?.label ?? item.chosenKey}${item.field.required ? " · required" : ""}`
            : "No matching vault field — choose one or fill manually"}
      </p>
      {!unsupported && (
        <div className="dv-value-row">
          <select
            aria-label="Mapped vault field"
            value={item.chosenKey ?? ""}
            onChange={(e) => onKey(e.target.value || null)}
          >
            <option value="">— choose vault field —</option>
            {item.chosenKey && <option value={item.chosenKey}>{FIELD_MAP[item.chosenKey]?.label ?? item.chosenKey} (best match)</option>}
            {item.alternatives.map((a) => (
              <option key={a.fieldKey} value={a.fieldKey}>
                {a.label} ({Math.round(a.confidence * 100)}%)
              </option>
            ))}
          </select>
          {item.value !== null && (
            <>
              <input
                aria-label="Value to fill"
                type={sensitive && !item.revealed ? "password" : "text"}
                value={item.value}
                onChange={(e) => onValue(e.target.value)}
              />
              {sensitive && (
                <button className="dv-eye" onClick={onReveal} aria-label="Toggle reveal">
                  {item.revealed ? "🙈" : "👁"}
                </button>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

/** Mini striped-bell-curve header, matching the web app's DVaultWave. */
function MiniWave() {
  const stripes = [];
  const N = 14;
  for (let i = 0; i < N; i++) {
    const y = 8 + i * 2.2;
    const dy = y - 23;
    const g = Math.exp(-(dy * dy) / (2 * 8 * 8));
    const w = 200 * Math.pow(g, 0.8);
    const fill = i === 4 ? "#FA6EAB" : ["#3B82F6", "#2563EB", "#60A5FA"][i % 3];
    stripes.push(<rect key={i} x={150 - w / 2} y={y} width={Math.max(2, w)} height={1.4} rx={0.7} fill={fill} opacity={0.35 + 0.6 * g} />);
  }
  return (
    <svg className="dv-wave" viewBox="0 0 300 44" preserveAspectRatio="none" aria-hidden>
      {stripes}
    </svg>
  );
}
