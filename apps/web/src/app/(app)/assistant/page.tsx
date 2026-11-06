"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  Mic, Square, Loader2, CircleAlert, Check, ShieldCheck, Keyboard,
  ChevronRight, Eye, EyeOff, Sparkles, ExternalLink, MicOff,
} from "lucide-react";
import { DVaultWave } from "@/components/brand/DVaultWave";
import { DBadge } from "@/components/brand/DBadge";
import { Button, Badge, Skeleton } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";
import { useVaultSession } from "@/lib/client/vault-session";
import { useAssistantSettings } from "@/lib/client/assistant-settings";
import { PcmRecorder, parseIntent, stripWakePhrase, EXAMPLE_COMMANDS, FIELD_MAP, fallbackLocale, localizedReply, type ParsedIntent } from "@dvault/core";

type AssistantState =
  | "idle" | "listening" | "processing" | "responding"
  | "awaiting-confirmation" | "error";

/** Minimal local typings for the (non-standard) Web Speech API fallback. */
interface FallbackRecognition {
  lang: string;
  interimResults: boolean;
  onresult: ((e: { results: { transcript: string }[][] & { item(i: number): { 0: { transcript: string } } } }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
}
type FallbackRecognitionCtor = new () => FallbackRecognition;

interface Turn {
  role: "user" | "d";
  text: string;
  intent?: string;
  kind?: "err";
  ui?: "value" | "confirmation" | "applications" | "hint" | "error" | "list";
  payload?: unknown;
}

interface VoiceStatus {
  voice: {
    configured: boolean;
    sttModel: string;
    ttsModel: string;
    ttsVoice: string;
    languages: string[];
    fallback: { provider: string; note: string };
  };
  ai: { mapping: string; model: string; brain?: boolean; provider?: string };
}

interface PendingSave {
  kind: "save" | "update";
  intent: ParsedIntent;
  profileId: string;
  profileName: string;
}

export default function AssistantPage() {
  const session = useVaultSession();
  const { toast } = useToast();
  const { settings } = useAssistantSettings();
  const [state, setState] = useState<AssistantState>("idle");
  const [status, setStatus] = useState<VoiceStatus | null>(null);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [typed, setTyped] = useState("");
  const [pending, setPending] = useState<PendingSave | null>(null);
  const [reveal, setReveal] = useState<Record<string, boolean>>({});
  const [activeProfile, setActiveProfile] = useState<"personal" | "business">("personal");
  const [conversationLoaded, setConversationLoaded] = useState(false);
  const recorderRef = useRef<PcmRecorder | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const spokenRef = useRef<string>("");
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    fetch("/api/voice/status")
      .then((r) => r.json())
      .then((s: VoiceStatus) => setStatus(s))
      .catch(() => setStatus(null));
  }, []);

  // ── load previous conversation on mount ────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    fetch("/api/settings", { credentials: "include" })
      .then((r) => r.json())
      .then((d: { conversation?: Turn[] }) => {
        if (cancelled || !Array.isArray(d.conversation) || d.conversation.length === 0) {
          setConversationLoaded(true);
          return;
        }
        // restore the transcript — strip decrypted values from payloads
        const restored = d.conversation
          .filter((t) => t && typeof t.text === "string")
          .map((t) => ({
            role: t.role === "user" ? ("user" as const) : ("d" as const),
            text: t.text,
            intent: t.intent,
            kind: t.kind,
            ui: t.ui === "value" ? ("hint" as const) : t.ui,
          }));
        if (restored.length > 0) {
          setTurns(restored.slice(-30));
        }
        setConversationLoaded(true);
      })
      .catch(() => setConversationLoaded(true));
    return () => {
      cancelled = true;
    };
  }, []);

  // ── persist conversation after changes (debounced) ─────────────────────
  const persistConversation = useCallback((current: Turn[]) => {
    if (!conversationLoaded) return;
    // strip decrypted values before persisting — only store the transcript
    const safe = current.slice(-60).map((t) => ({
      role: t.role,
      text: t.text,
      intent: t.intent,
      kind: t.kind,
      ui: t.ui === "value" ? "hint" : t.ui,
    }));
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ "assistant.conversation": JSON.stringify(safe) }),
      }).catch(() => undefined);
    }, 800);
  }, [conversationLoaded]);

  useEffect(() => {
    if (turns.length > 0 && conversationLoaded) {
      persistConversation(turns);
    }
  }, [turns, conversationLoaded, persistConversation]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [turns]);

  // fetch the user's name/email for display
  const [userName, setUserName] = useState<string>("");
  useEffect(() => {
    fetch("/api/settings", { credentials: "include" })
      .then((r) => r.json())
      .then((d: { user?: { email?: string | null; name?: string | null } }) => {
        if (d.user?.name && d.user.name !== "Local user") setUserName(d.user.name);
        else if (d.user?.email) setUserName(d.user.email.split("@")[0]);
      })
      .catch(() => undefined);
  }, []);

  const addTurn = (t: Turn) => setTurns((prev) => [...prev, t]);

  // ------------------- TTS: Gnani first, browser synthesis fallback -------
  const speak = useCallback(async (text: string) => {
    if (spokenRef.current === text) return;
    spokenRef.current = text;
    // only try Gnani TTS when it's actually configured — skip the 503 otherwise
    if (status?.voice.configured) {
      try {
        const res = await fetch("/api/voice/tts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            text,
            language: settings.language === "indic-auto" ? "hi-IN" : settings.language,
            voice: settings.voice,
          }),
        });
        if (res.ok) {
          const blob = await res.blob();
          const url = URL.createObjectURL(blob);
          await new Audio(url).play().catch(() => undefined);
          URL.revokeObjectURL(url);
          return;
        }
      } catch { /* fall through */ }
    }
    // clearly-labelled fallback: browser speech synthesis (NOT Gnani)
    if ("speechSynthesis" in window) {
      const u = new SpeechSynthesisUtterance(text);
      u.rate = 1.02;
      u.lang = fallbackLocale(settings.language);
      speechSynthesis.cancel();
      speechSynthesis.speak(u);
    }
  }, [status, settings.language]);

  // ── LLM fallback for intent parsing ─────────────────────────────────────
  const llmParseIntent = useCallback(async (text: string): Promise<ParsedIntent | null> => {
    // only call when the LLM is actually configured — skip the 503 otherwise
    if (!status?.ai?.brain) return null;
    try {
      const res = await fetch("/api/ai/intent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          utterance: text,
          language: settings.language,
          profileHint: activeProfile,
        }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        configured?: boolean;
        error?: string;
        intent?: {
          intent: string;
          field_key: string | null;
          value: string | null;
          profile_type: "personal" | "business" | null;
          confidence: number;
          explanation: string;
          requires_confirmation: boolean;
        };
      };
      if (!data.ok || !data.intent) return null;
      return {
        intent: data.intent.intent as ParsedIntent["intent"],
        field_key: data.intent.field_key ?? undefined,
        value: data.intent.value ?? undefined,
        profile_type: data.intent.profile_type ?? undefined,
        requires_confirmation: data.intent.requires_confirmation,
        confidence: data.intent.confidence,
        explanation: data.intent.explanation,
        utterance: text,
      };
    } catch {
      return null;
    }
  }, [settings.language, activeProfile, status]);

  // ------------------- handle a transcript -------------------------------
  // A plain function (not useCallback): it is recreated on every render so it
  // always closes over the CURRENT session/user state. The old useCallback
  // held a stale `session: null` from before the vault finished bootstrapping,
  // which made every command die silently at `if (!session) return`.
  async function handleTranscript(transcript: string, viaVoice: boolean) {
    if (!transcript.trim()) return;
    if (!session) {
      addTurn({ role: "user", text: transcript });
      addTurn({
        role: "d",
        text: "The vault is still unlocking on this device — give it a second and try again.",
        ui: "error",
      });
      return;
    }
    addTurn({ role: "user", text: transcript });
    setState("processing");

    // ── KIMI IS THE BRAIN ────────────────────────────────────────────────
    // Only call the brain when the LLM is actually configured (checked via
    // /api/voice/status which already reports ai.mapping). When not configured,
    // we go straight to the deterministic engine — no 503 in the console.
    let brainResponse: string | null = null;
    let brainIntent: string | null = null;
    let brainFieldKey: string | null = null;
    let brainValue: string | null = null;
    let brainProfileType: "personal" | "business" | null = null;
    let brainConfigured = false;

    const llmAvailable = status?.ai?.mapping === "llm-assisted";

    if (llmAvailable) {
      // show "thinking" indicator while Kimi processes
      setState("processing");
      addTurn({ role: "d", text: "🧠 Thinking…", intent: "THINKING", ui: "hint" });

      // 20-second timeout — if Kimi can't respond in time, fall back to deterministic
      const brainController = new AbortController();
      const brainTimeout = setTimeout(() => brainController.abort(), 35_000);

      try {
        const brainRes = await fetch("/api/assistant/brain", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          signal: brainController.signal,
          body: JSON.stringify({
            utterance: transcript,
            language: settings.language,
            speakSensitive: settings.speakSensitive,
          }),
        });
        clearTimeout(brainTimeout);
        const brainData = (await brainRes.json()) as {
          ok?: boolean;
          configured?: boolean;
          error?: string;
          brain?: {
            response: string;
            intent: string;
            field_key: string | null;
            value: string | null;
            profile_type: "personal" | "business" | null;
          };
        };
        console.log("[D-Vault brain] ok:", brainData.ok, "intent:", brainData.brain?.intent, "field_key:", brainData.brain?.field_key);
        if (brainData.ok && brainData.brain) {
          brainConfigured = true;
          brainResponse = brainData.brain.response;
          brainIntent = brainData.brain.intent;
          brainFieldKey = brainData.brain.field_key;
          brainValue = brainData.brain.value;
          brainProfileType = brainData.brain.profile_type;
        }
      } catch (brainErr) {
        clearTimeout(brainTimeout);
        console.log("[D-Vault brain] timeout/error:", brainErr instanceof Error ? brainErr.message : String(brainErr));
      }
      // remove the "thinking" placeholder
      setTurns((prev) => prev.filter((t) => t.intent !== "THINKING"));
    }

    // ── route the intent ──────────────────────────────────────────────────
    // If the brain understood, use its structured intent + response.
    // Otherwise, use the deterministic engine's result.
    let intent: ParsedIntent;

    if (brainConfigured && brainIntent && brainIntent !== "UNKNOWN") {
      // ── BRAIN path: Kimi understood ────────────────────────────────────
      addTurn({
        role: "d",
        text: brainResponse ?? "",
        intent: brainIntent,
        ui: "hint",
      });

      // for GET intents, speak the brain's response (it includes the value)
      if (brainIntent === "GET_PERSONAL_INFORMATION" || brainIntent === "GET_BUSINESS_INFORMATION") {
        void speak(brainResponse ?? "");
        setState("responding");
        return;
      }

      // for GREETING, just show + speak
      if (brainIntent === "GREETING") {
        void speak(brainResponse ?? "");
        setState("responding");
        return;
      }

      // for other intents, build a ParsedIntent from the brain's output
      intent = {
        intent: brainIntent as ParsedIntent["intent"],
        field_key: brainFieldKey ?? undefined,
        value: brainValue ?? undefined,
        profile_type: brainProfileType ?? undefined,
        requires_confirmation: ["SAVE_INFORMATION", "UPDATE_INFORMATION", "FILL_ACTIVE_FORM", "SAVE_APPLICATION"].includes(brainIntent),
        confidence: 0.9,
        explanation: brainResponse ?? "",
        utterance: transcript,
      };
    } else {
      // ── DETERMINISTIC fallback (brain not configured or didn't understand) ──
      intent = parseIntent(transcript);

      // try the lighter /api/ai/intent fallback too
      const needsLlm =
        intent.intent === "UNKNOWN" ||
        (intent.intent === "GET_PERSONAL_INFORMATION" && !intent.field_key) ||
        (intent.intent === "GET_BUSINESS_INFORMATION" && !intent.field_key);
      if (needsLlm) {
        const llmIntent = await llmParseIntent(transcript);
        if (llmIntent && llmIntent.intent !== "UNKNOWN") {
          addTurn({ role: "d", text: `[AI] ${llmIntent.explanation}`, intent: llmIntent.intent, ui: "hint" });
          intent = llmIntent;
        } else {
          addTurn({ role: "d", text: intent.explanation, intent: intent.intent, ui: "hint" });
        }
      } else {
        addTurn({ role: "d", text: intent.explanation, intent: intent.intent, ui: "hint" });
      }
    }

    try {
      switch (intent.intent) {
        case "SET_ACTIVE_PROFILE":
          setActiveProfile(intent.profile_type ?? "personal");
          setState("responding");
          void speak(localizedReply("using_profile", settings.language, { type: intent.profile_type ?? "personal" }));
          break;

        case "GET_PERSONAL_INFORMATION":
        case "GET_BUSINESS_INFORMATION":
          await handleGetValue(intent);
          break;

        case "SAVE_INFORMATION":
        case "UPDATE_INFORMATION":
          await handleProposedSave(intent);
          break;

        case "SEARCH_APPLICATIONS":
          await handleSearchApplications(intent);
          break;

        case "GET_APPLICATION_DETAILS":
          await handleApplicationDetail(intent);
          break;

        case "FILL_ACTIVE_FORM":
          setState("responding");
          addTurn({
            role: "d",
            text: "To fill a live form, use the Chrome extension on that page: click the floating D button and say “fill this form”. The web app can't touch other tabs for security.",
            intent: intent.intent,
            ui: "hint",
          });
          void speak(localizedReply("fill_extension", settings.language));
          break;

        case "SAVE_APPLICATION":
          setState("responding");
          addTurn({
            role: "d",
            text: "Saving an application with its screenshot works from the extension on the page you submitted. Open the page, click D, and say “save this application”. Here you can also add it manually.",
            intent: intent.intent,
            ui: "hint",
          });
          void speak(localizedReply("save_ext_hint", settings.language));
          break;

        case "UPLOAD_DOCUMENT":
          setState("responding");
          addTurn({
            role: "d",
            text: "Opening the document vault — you can drag a file there and I'll extract text on your device.",
            intent: intent.intent,
            ui: "hint",
          });
          break;

        case "UNKNOWN":
          setState("error");
          addTurn({
            role: "d",
            text: intent.explanation,
            ui: "error",
          });
          break;
      }
    } catch {
      setState("error");
      addTurn({ role: "d", text: "Something went wrong executing that command. Please try again.", ui: "error" });
    } finally {
      // functional update — reads the CURRENT state, not the stale closure
      setState((s) => (s === "processing" || s === "listening" ? "idle" : s));
    }
    void viaVoice;
  }

  // ------------------- intent: get value ----------------------------------
  async function handleGetValue(intent: ParsedIntent) {
    if (!session || !intent.field_key) return;
    const wantType = intent.intent === "GET_BUSINESS_INFORMATION" ? "business" : "personal";
    const pRes = await fetch("/api/profiles", { credentials: "include" });
    const { profiles } = (await pRes.json()) as { profiles: { id: string; profileType: string; profileName: string }[] };
    const profile = profiles.find((p) => p.profileType === wantType) ?? profiles.find((p) => p.profileType === (wantType === "business" ? "personal" : "business"));
    if (!profile) {
      setState("responding");
      addTurn({ role: "d", text: `You don't have a ${wantType} profile yet. Create one first from the Profiles page.`, ui: "hint" });
      return;
    }
    const fRes = await fetch(`/api/profiles/${profile.id}/fields`, { credentials: "include" });
    const { fields } = (await fRes.json()) as { fields: { fieldKey: string; encryptedValue: { c: string; iv: string }; isSensitive: boolean }[] };
    const row = fields.find((f) => f.fieldKey === intent.field_key);
    const def = FIELD_MAP[intent.field_key];
    if (!row) {
      setState("responding");
      addTurn({ role: "d", text: `You haven't stored “${def?.label ?? intent.field_key}” yet. You can say “remember that my ${def?.label.toLowerCase() ?? "value"} is …” to add it.`, ui: "hint" });
      void speak(localizedReply("not_stored", settings.language));
      return;
    }
    const value = await session.decrypt(row.encryptedValue).catch(() => null);
    setState("responding");
    addTurn({
      role: "d",
      text: def?.sensitive ? `${def.label} — shown masked${settings.speakSensitive ? " and spoken in full (your setting)" : ", not spoken in full"}.` : `${def?.label ?? intent.field_key}:`,
      intent: intent.intent,
      ui: "value",
      payload: { fieldKey: intent.field_key, label: def?.label, value, sensitive: def?.sensitive ?? false },
    });
    if (!def?.sensitive && value) {
      void speak(localizedReply("value_is", settings.language, { label: intent.field_key ?? "", value: value.slice(0, 80) }));
    } else if (settings.speakSensitive && value) {
      // explicit opt-in from Settings — D reads the full value aloud
      void speak(localizedReply("value_is", settings.language, { label: intent.field_key ?? "", value }));
    } else {
      void speak(localizedReply("sensitive_masked", settings.language));
    }
  }

  // ------------------- intent: save/update confirmation --------------------
  async function handleProposedSave(intent: ParsedIntent) {
    if (!session) return;
    const wantType = FIELD_MAP[intent.field_key ?? ""]?.profileType ?? activeProfile;
    const pRes = await fetch("/api/profiles", { credentials: "include" });
    const { profiles } = (await pRes.json()) as { profiles: { id: string; profileType: string; profileName: string }[] };
    const profile = profiles.find((p) => p.profileType === wantType);
    if (!profile) {
      setState("error");
      addTurn({ role: "d", text: "You don't have a " + wantType + " profile yet. Create one from the Profiles page first.", ui: "error" });
      return;
    }
    if (!intent.field_key) {
      setState("error");
      addTurn({ role: "d", text: "I understood you want to save something, but couldn't identify which vault field. Try naming the field: \"my full name is…\" or \"my city is…\"", ui: "error" });
      return;
    }
    if (!intent.value) {
      setState("error");
      addTurn({ role: "d", text: "I understood the field but didn't catch the value. Could you repeat that?", ui: "error" });
      return;
    }
    setState("awaiting-confirmation");
    setPending({
      kind: intent.intent === "SAVE_INFORMATION" ? "save" : "update",
      intent,
      profileId: profile.id,
      profileName: profile.profileName,
    });
  }

  async function confirmSave() {
    if (!session || !pending) return;
    const { intent, profileId } = pending;
    try {
      const env = await session.encrypt(intent.value ?? "");
      const res = await fetch(`/api/profiles/${profileId}/fields`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ fieldKey: intent.field_key, encryptedValue: env, verified: false }),
      });
      if (!res.ok) throw new Error();
      addTurn({ role: "d", text: `Saved. ${FIELD_MAP[intent.field_key ?? ""]?.label} is now “${intent.value}” (encrypted).`, ui: "hint" });
      void speak(localizedReply("saved", settings.language));
      setState("responding");
    } catch {
      addTurn({ role: "d", text: "Could not save that value. Please try again.", ui: "error" });
      setState("error");
    } finally {
      setPending(null);
    }
  }

  // ------------------- intent: applications search ------------------------
  async function handleSearchApplications(intent: ParsedIntent) {
    const params = new URLSearchParams();
    if (intent.status) params.set("status", intent.status);
    if (intent.timeframe && intent.timeframe !== "all") params.set("timeframe", intent.timeframe);
    const res = await fetch(`/api/applications?${params}`, { credentials: "include" });
    const { applications } = (await res.json()) as {
      applications: { id: string; applicationName: string; websiteDomain: string; status: string; submissionDate: string | null }[];
    };
    setState("responding");
    addTurn({
      role: "d",
      text: applications.length
        ? `Found ${applications.length} saved application${applications.length === 1 ? "" : "s"}.`
        : "No saved applications match that. Records appear here only after you save them (via the extension or manually).",
      intent: intent.intent,
      ui: "applications",
      payload: applications.slice(0, 6),
    });
    void speak(applications.length
        ? localizedReply("found_apps", settings.language, { n: applications.length })
        : localizedReply("no_apps", settings.language));
  }

  async function handleApplicationDetail(intent: ParsedIntent) {
    const res = await fetch("/api/applications", { credentials: "include" });
    const { applications } = (await res.json()) as {
      applications: { id: string; applicationName: string; encryptedReferenceId: { c: string; iv: string } | null; submissionDate: string | null }[];
    };
    const q = intent.query?.toLowerCase() ?? "";
    const match = q
      ? applications.find((a) => a.applicationName.toLowerCase().includes(q))
      : applications[0];
    setState("responding");
    if (!match) {
      addTurn({ role: "d", text: `I couldn't find a saved application matching “${intent.query ?? ""}”. I won't guess — only applications you saved appear here.`, ui: "hint" });
      void speak(localizedReply("no_match", settings.language));
      return;
    }
    const ref = match.encryptedReferenceId && session
      ? await session.decrypt(match.encryptedReferenceId).catch(() => null)
      : null;
    addTurn({
      role: "d",
      text: `${match.applicationName}:`,
      intent: intent.intent,
      ui: "value",
      payload: {
        fieldKey: `ref:${match.id}`,
        label: intent.field_requested === "date" ? "Submission date" : "Reference / acknowledgement ID",
        value: intent.field_requested === "date"
          ? (match.submissionDate ? new Date(match.submissionDate).toLocaleDateString() : "Not recorded")
          : (ref ?? "No reference ID saved"),
        sensitive: false,
      },
    });
    void speak(localizedReply("ref_shown", settings.language));
  }

  // ------------------- voice capture (click-to-talk) -----------------------
  async function startListening() {
    if (state === "listening") return;
    // Only on explicit click — never ambient listening.
    if (status?.voice.configured) {
      const rec = new PcmRecorder();
      recorderRef.current = rec;
      try {
        await rec.start();
        setState("listening");
      } catch {
        setState("error");
        addTurn({ role: "d", text: "Microphone access was blocked. Allow the mic in your browser and click again.", ui: "error" });
        return;
      }
    } else if ("webkitSpeechRecognition" in window || "SpeechRecognition" in window) {
      // Fallback (clearly labelled): browser Web Speech, NOT Gnani
      const w = window as unknown as {
        SpeechRecognition?: FallbackRecognitionCtor;
        webkitSpeechRecognition?: FallbackRecognitionCtor;
      };
      const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
      if (!Ctor) {
        setState("error");
        return;
      }
      const rec = new Ctor();
      rec.lang = fallbackLocale(settings.language);
      rec.interimResults = false;
      rec.onresult = (e) => {
        const text = e.results[0][0].transcript;
        void handleTranscript(text, true);
      };
      rec.onerror = (e) => {
        setState("error");
        addTurn({ role: "d", text: `Browser speech recognition failed (${e.error}). Type your command instead, or configure Gnani.ai for real voice.`, ui: "error" });
      };
      rec.onend = () => setState((s) => (s === "listening" ? "processing" : s));
      (window as unknown as { __dvFallbackRec?: FallbackRecognition }).__dvFallbackRec = rec;
      try {
        rec.start();
        setState("listening");
      } catch {
        setState("error");
      }
    } else {
      setState("error");
      addTurn({
        role: "d",
        text: "No speech provider available: Gnani.ai isn't configured on this server and this browser lacks Web Speech. Type your command below — every voice action has a typed equivalent.",
        ui: "error",
      });
    }
  }

  async function stopListening() {
    if (status?.voice.configured && recorderRef.current) {
      setState("processing");
      const blob = await recorderRef.current.stop();
      recorderRef.current = null;
      if (!blob || blob.size < 2000) {
        setState("error");
        addTurn({ role: "d", text: "That was too short — hold the microphone and speak after the click.", ui: "error" });
        return;
      }
      try {
        const form = new FormData();
        form.append("audio", blob, "command.wav");
        form.append("language", settings.language === "indic-auto" ? "indic-auto" : settings.language);
        const res = await fetch("/api/voice/stt", { method: "POST", credentials: "include", body: form });
        if (res.ok) {
          const { transcript } = (await res.json()) as { transcript?: string };
          if (!transcript) {
            setState("error");
            addTurn({ role: "d", text: "Gnani returned no transcript. Try again a little louder.", ui: "error" });
            return;
          }
          await handleTranscript(transcript, true);
        } else {
          const err = (await res.json()) as { error?: string };
          setState("error");
          addTurn({ role: "d", text: err.error ?? "Voice provider error.", ui: "error" });
        }
      } catch {
        setState("error");
        addTurn({ role: "d", text: "Could not reach the voice service.", ui: "error" });
      }
    } else {
      const rec = (window as unknown as { __dvFallbackRec?: FallbackRecognition }).__dvFallbackRec;
      rec?.stop();
      setState((s) => (s === "listening" ? "processing" : s));
    }
  }

  if (!session) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Skeleton className="h-40 w-80" />
      </div>
    );
  }

  const listening = state === "listening";

  return (
    <div className="dark-surface min-h-screen">
      {/* the signature curves, faded into a calm backdrop so the chat
          dominates — never a harsh field behind the text */}
      <div aria-hidden className="fixed inset-0 opacity-45">
        <DVaultWave variant="hero" animated fill className="absolute inset-0 h-full w-full" />
      </div>
      {/* extra softening over the curve where the transcript lives */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 z-[5]"
        style={{
          background:
            "linear-gradient(180deg, rgba(6,11,27,0.30) 0%, rgba(6,11,27,0.62) 30%, rgba(6,11,27,0.72) 70%, rgba(6,11,27,0.55) 100%)",
        }}
      />
      <div className="relative z-10 mx-auto flex min-h-screen max-w-3xl flex-col px-5 py-10 sm:px-8">
        {/* header */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <DBadge size={44} className={listening ? "float-slow" : ""} />
            <div>
              <h1 className="font-display text-[20px] font-extrabold text-white">D</h1>
              <p className="text-[12px] text-slate-400">Your voice-first vault assistant</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {status ? (
              status.voice.configured ? (
                <Badge tone="green"><ShieldCheck className="h-3 w-3" /> Gnani.ai connected</Badge>
              ) : (
                <Badge tone="amber">Browser speech fallback — not Gnani</Badge>
              )
            ) : (
              <Badge tone="gray">checking voice status…</Badge>
            )}
            <Badge tone="dark" className="border-ice-300/40 bg-white/10 text-ice-200">
              profile: {activeProfile === "business" ? "Business vault" : "Personal vault"}
            </Badge>
          </div>
        </div>

        {/* transcript area */}
        <div ref={scrollRef} className="mt-8 flex-1 space-y-4 overflow-y-auto pb-4 pr-1" style={{ maxHeight: "52vh" }}>
          {turns.length === 0 && (
            <div className="rise-in flex flex-col items-center gap-4 pt-6 text-center">
              <p className="max-w-md text-balance text-[15px] leading-relaxed text-slate-400">
                Click the microphone and speak — or type. I only start listening after you click.
                Try one of these:
              </p>
              <div className="flex flex-wrap justify-center gap-2">
                {EXAMPLE_COMMANDS.slice(0, 6).map((c) => (
                  <button
                    key={c.phrase}
                    onClick={() => handleTranscript(stripWakePhrase(c.phrase), false)}
                    className="rounded-full border border-ice-300/30 bg-white/10 px-3.5 py-1.5 text-[12px] font-medium text-ice-200 transition hover:border-ice-300/60 hover:bg-white/15"
                    title={c.note}
                  >
                    {c.phrase}
                  </button>
                ))}
              </div>
              {status && !status.voice.configured && (
                <p className="max-w-md rounded-xl border border-amber-400/20 bg-amber-400/5 px-4 py-3 text-[12px] leading-relaxed text-amber-200/80">
                  <strong>Honest status:</strong> {status.voice.fallback.note}
                </p>
              )}
              {status && status.ai.mapping === "deterministic-on-device" && status.ai.brain === false && (
                <p className="max-w-md rounded-xl border border-ice-300/20 bg-ice-300/5 px-4 py-3 text-[12px] leading-relaxed text-slate-400">
                  <strong>Brain:</strong> deterministic on-device engine is active.
                  Set <code className="rounded bg-white/5 px-1 py-0.5 font-mono text-[11px] text-ice-300">LLM_API_KEY</code> +{" "}
                  <code className="rounded bg-white/5 px-1 py-0.5 font-mono text-[11px] text-ice-300">CF_ACCOUNT_ID</code> in{" "}
                  <code className="font-mono text-[11px] text-ice-300">apps/web/.env</code> to connect Kimi K2.7 as the brain —
                  it will understand any language and answer from your full vault.
                </p>
              )}
            </div>
          )}

          {turns.map((t, i) => (
            <div key={i} className={`rise-in flex ${t.role === "user" ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-[13.5px] leading-relaxed shadow-lift ${
                t.role === "user"
                  ? "bg-white text-ink-900"
                  : t.kind === "err"
                    ? "bg-white text-red-700"
                    : "bg-white text-ink-900"
              }`}>
                {t.role === "d" && t.intent && (
                  <p className="mb-1.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-electric-600">
                    {t.intent}
                  </p>
                )}
                {t.ui === "value" && (() => {
                  const p = t.payload as { fieldKey: string; label?: string; value: string | null; sensitive: boolean };
                  const shown = p.value ?? "—";
                  const hidden = p.sensitive && !reveal[p.fieldKey];
                  return (
                    <div>
                      <p className="text-[12.5px] text-slate-500">{t.text}</p>
                      <p className="mt-1 break-all font-mono text-[13px] font-semibold text-ink-900">
                        {hidden ? "•••• •••• ••••" + shown.slice(-2) : shown}
                      </p>
                      {p.sensitive && (
                        <button
                          onClick={() => setReveal((r) => ({ ...r, [p.fieldKey]: !r[p.fieldKey] }))}
                          className="mt-1.5 inline-flex items-center gap-1.5 text-[11px] font-semibold text-electric-600 transition hover:text-ink-900"
                        >
                          {hidden ? <><Eye className="h-3 w-3" /> Reveal</> : <><EyeOff className="h-3 w-3" /> Hide</>}
                        </button>
                      )}
                    </div>
                  );
                })()}

                {t.ui === "applications" && Array.isArray(t.payload) && (
                  <div className="space-y-1.5">
                    <p>{t.text}</p>
                    {(t.payload as { id: string; applicationName: string; websiteDomain: string; status: string }[]).map((a) => (
                      <Link key={a.id} href={`/applications/${a.id}`} className="flex items-center justify-between rounded-lg border border-mist-200 bg-mist-50 px-3 py-2 text-[12.5px] text-ink-900 transition hover:border-ice-300">
                        <span className="truncate">{a.applicationName}</span>
                        <span className="ml-3 shrink-0 text-[11px] text-slate-500">{a.status}</span>
                      </Link>
                    ))}
                  </div>
                )}

                {!t.ui || t.ui === "hint" || t.ui === "error" ? (
                  <p className={t.ui === "error" ? "font-medium text-red-600" : ""}>{t.text}</p>
                ) : null}
              </div>
            </div>
          ))}

          {pending && (
            <div className="rise-in flex justify-start">
              <div className="max-w-[85%] rounded-2xl border border-electric-600/40 bg-white px-4 py-3.5 text-[13.5px] text-ink-900 shadow-lift">
                <p className="text-[12.5px] font-semibold text-electric-600">
                  {pending.kind === "save" ? "Save this to your vault?" : "Update this field?"}
                </p>
                <p className="mt-1.5">
                  <span className="font-semibold text-ink-900">{FIELD_MAP[pending.intent.field_key ?? ""]?.label ?? pending.intent.field_key}</span>
                  {" → "}
                  <span className="font-mono text-ink-900">“{pending.intent.value}”</span>
                </p>
                <p className="mt-1 text-[11.5px] text-slate-500">
                  Into “{pending.profileName}”. I understood that from your voice — correct it if I misheard.
                </p>
                <div className="mt-3 flex gap-2">
                  <Button size="sm" icon={<Check className="h-3.5 w-3.5" />} onClick={confirmSave}>Yes, save</Button>
                  <Button size="sm" variant="secondary" onClick={() => { setPending(null); setState("idle"); addTurn({ role: "d", text: "Discarded. Nothing was saved.", ui: "hint" }); }}>
                    No, discard
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* status line */}
        <div className="mt-2 flex h-5 items-center justify-center gap-2 text-[12px] font-medium" aria-live="polite">
          {state === "idle" && <span className="text-slate-500">Click the mic — I don't listen until you do.</span>}
          {listening && (
            <span className="flex items-center gap-2 text-ice-300">
              <span className="flex h-4 items-end gap-[3px]" aria-hidden>
                {[0, 1, 2].map((i) => (
                  <span key={i} className="mic-bar block h-3 w-[3px] rounded-full bg-ice-300" style={{ animationDelay: `${i * 0.18}s` }} />
                ))}
              </span>
              Listening… speak, then click stop
            </span>
          )}
          {state === "processing" && <span className="flex items-center gap-1.5 text-slate-400"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Processing with {status?.voice.configured ? "Gnani.ai" : "browser speech"}…</span>}
          {state === "responding" && <span className="text-slate-500">Ready for your next command.</span>}
          {state === "awaiting-confirmation" && <span className="text-blush-300">Waiting for your confirmation.</span>}
          {state === "error" && <span className="flex items-center gap-1.5 text-red-400"><CircleAlert className="h-3.5 w-3.5" /> Something needs attention — see above.</span>}
        </div>

        {/* controls */}
        <div className="mt-4 flex items-center justify-center gap-3">
          {!listening ? (
            <button
              onClick={startListening}
              disabled={state === "processing"}
              aria-label="Start speaking"
              className="relative flex h-16 w-16 items-center justify-center rounded-full bg-electric-600 text-white shadow-glow-blue transition hover:bg-bright-500 disabled:opacity-50"
            >
              {!status?.voice.configured && <MicOff className="absolute -right-0.5 -top-0.5 h-4 w-4 rounded-full bg-amber-400 p-0.5 text-ink-900" />}
              <Mic className="h-7 w-7" />
              {listening && <span className="pulse-ring absolute inset-0 rounded-full border-2 border-ice-300" />}
            </button>
          ) : (
            <button
              onClick={stopListening}
              aria-label="Stop and send"
              className="flex h-16 w-16 items-center justify-center rounded-full bg-white text-ink-900 shadow-lift transition hover:bg-ice-200"
            >
              <Square className="h-6 w-6" />
            </button>
          )}
        </div>

        {/* typed fallback */}
        <form
          onSubmit={(e) => { e.preventDefault(); const v = typed; setTyped(""); handleTranscript(v, false); }}
          className="mt-5 flex items-center gap-2 rounded-2xl border border-white/10 bg-ink-950/70 px-4 py-3 backdrop-blur"
        >
          <Keyboard className="h-4.5 w-4.5 shrink-0 text-slate-500" />
          <input
            aria-label="Type a command"
            placeholder='Type a command — e.g. "what is my full name?"'
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            className="flex-1 bg-transparent text-[14px] text-white placeholder:text-slate-500 focus:outline-none"
          />
          <Button type="submit" size="sm" disabled={!typed.trim()}>
            Send <ChevronRight className="h-3.5 w-3.5" />
          </Button>
        </form>

        <p className="mt-4 flex flex-wrap items-center justify-center gap-1.5 text-center text-[11px] leading-relaxed text-slate-500">
          <Sparkles className="h-3 w-3 text-blush-300" />
          Sensitive values are shown masked instead of spoken. OTPs are never stored.
        </p>
      </div>
    </div>
  );
}
