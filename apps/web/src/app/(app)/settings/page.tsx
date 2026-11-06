"use client";

import { useState, useEffect } from "react";
import { Download, Trash2, Puzzle, KeyRound, Mic, Volume2, Eye, Mail } from "lucide-react";
import { Button, Card, Input, Badge, Select } from "@/components/ui/primitives";
import { ConfirmDialog } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { useRouter } from "next/navigation";
import { ASSISTANT_LANGUAGES, ASSISTANT_VOICES } from "@/lib/core";
import { useAssistantSettings } from "@/lib/client/assistant-settings";

export default function SettingsPage() {
  const { toast } = useToast();
  const router = useRouter();
  const [eraseOpen, setEraseOpen] = useState(false);
  const [eraseConfirm, setEraseConfirm] = useState("");
  const [eraseBusy, setEraseBusy] = useState(false);
  const { settings, save, loaded } = useAssistantSettings();
  const [testing, setTesting] = useState(false);
  const [email, setEmail] = useState("");
  const [emailLoaded, setEmailLoaded] = useState(false);
  const [savingEmail, setSavingEmail] = useState(false);

  // load the user's email
  useEffect(() => {
    fetch("/api/settings", { credentials: "include" })
      .then((r) => r.json())
      .then((d: { user?: { email?: string | null } }) => {
        setEmail(d.user?.email ?? "");
        setEmailLoaded(true);
      })
      .catch(() => setEmailLoaded(true));
  }, []);

  async function saveEmail() {
    const trimmed = email.trim();
    if (trimmed && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      toast("error", "Please enter a valid email address.");
      return;
    }
    setSavingEmail(true);
    const ok = await save({ email: trimmed } as never).catch(() => false);
    // use the direct settings endpoint (email is handled by the server)
    const res = await fetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ "user.email": trimmed }),
    }).catch(() => null);
    setSavingEmail(false);
    if (res?.ok) {
      toast("success", trimmed ? `Vault identified with ${trimmed}.` : "Email removed.");
      router.refresh();
    } else {
      toast("error", "Could not save the email.");
    }
  }

  async function testVoice() {
    setTesting(true);
    try {
      const res = await fetch("/api/voice/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          text: "नमस्ते! आपकी जानकारी सुरक्षित है। Hello — your vault is ready.",
          language: settings.language === "indic-auto" ? "hi-IN" : settings.language,
          voice: settings.voice,
        }),
      });
      if (res.ok) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        await new Audio(url).play().catch(() => undefined);
        URL.revokeObjectURL(url);
        toast("success", "Testing your voice selection.");
      } else {
        // honest fallback: browser speech synthesis
        const u = new SpeechSynthesisUtterance("नमस्ते! Hello. Your vault is ready.");
        u.lang = settings.language === "indic-auto" ? "hi-IN" : settings.language;
        speechSynthesis.cancel();
        speechSynthesis.speak(u);
        toast("info", "Gnani TTS not configured — played the browser-voice fallback.");
      }
    } catch {
      toast("error", "Could not test the voice.");
    } finally {
      setTesting(false);
    }
  }

  async function eraseVault() {
    if (eraseConfirm !== "ERASE-MY-VAULT") return;
    setEraseBusy(true);
    const res = await fetch("/api/account", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ confirm: "ERASE-MY-VAULT" }),
    });
    setEraseBusy(false);
    if (res.ok) {
      setEraseOpen(false);
      toast("success", "Vault erased. Profiles, fields, documents and applications are gone.");
      router.push("/dashboard");
      router.refresh();
    } else {
      const { error } = await res.json();
      toast("error", error ?? "Could not erase the vault.");
    }
  }

  return (
    <div className="mx-auto max-w-5xl px-5 py-10 sm:px-10 sm:py-14">
      <h1 className="display-2 text-[32px] text-ink-900 sm:text-[40px]">Settings</h1>
      <p className="mt-2 text-[14.5px] text-slate-500">
        Local vault · no account · D-Vault runs open on your machine
      </p>

      <div className="mt-10 space-y-6">
        {/* your email — identifies the vault owner */}
        <Card className="p-7 sm:p-9">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-electric-600/10">
              <Mail className="h-5 w-5 text-electric-600" />
            </span>
            <div>
              <h2 className="font-display text-[18px] font-bold text-ink-900">Your email</h2>
              <p className="mt-1 text-[13.5px] text-slate-500">
                Identifies your vault so D remembers your conversation and information across sessions.
              </p>
            </div>
          </div>
          <div className="mt-5 flex flex-wrap items-end gap-3">
            <div className="min-w-[240px] flex-1">
              <Input
                label="Email address"
                type="email"
                placeholder="you@example.com"
                value={email}
                disabled={!emailLoaded}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && !savingEmail && saveEmail()}
                hint="Shown in the sidebar. D uses it to greet you and keep your history linked."
              />
            </div>
            <Button
              size="lg"
              variant="secondary"
              loading={savingEmail}
              disabled={!emailLoaded || email === (emailLoaded ? undefined : "")}
              onClick={saveEmail}
            >
              Save
            </Button>
          </div>
        </Card>

        {/* how this vault is secured */}
        <Card className="p-7 sm:p-9">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-electric-600/10">
              <KeyRound className="h-5 w-5 text-electric-600" />
            </span>
            <h2 className="font-display text-[18px] font-bold text-ink-900">How this vault is secured</h2>
          </div>
          <div className="mt-6 grid gap-5 md:grid-cols-2">
            <div className="rounded-2xl border border-mist-200 bg-mist-50 p-5">
              <Badge tone="blue">No account</Badge>
              <p className="mt-3 text-[14px] leading-relaxed text-slate-600">
                There is no login and no password. D-Vault opens directly — it is built for
                single-user, self-hosted use (localhost or your own server).
              </p>
            </div>
            <div className="rounded-2xl border border-mist-200 bg-mist-50 p-5">
              <Badge tone="green">AES-256-GCM</Badge>
              <p className="mt-3 text-[14px] leading-relaxed text-slate-600">
                Every value is still encrypted before storage; the instance key was generated
                once on first run. In this no-account mode the key is held by your own server —
                encryption protects the stored data, not against the server itself.
              </p>
            </div>
          </div>
        </Card>

        {/* D Assistant — language, voice (accent), sensitive speech */}
        <Card className="p-7 sm:p-9">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-electric-600/10">
              <Mic className="h-5 w-5 text-electric-600" />
            </span>
            <div>
              <h2 className="font-display text-[18px] font-bold text-ink-900">D Assistant — voice &amp; language</h2>
              <p className="mt-1 text-[13.5px] text-slate-500">
                Speech recognition, replies and accent for the assistant and the Chrome extension.
              </p>
            </div>
          </div>

          <div className="mt-6 grid gap-5 md:grid-cols-2">
            <div>
              <Select
                label="Language (recognition + replies)"
                value={settings.language}
                disabled={!loaded}
                onChange={(e) => void save({ language: e.target.value }).then((ok) => {
                  if (!ok) toast("error", "Could not save the language.");
                })}
              >
                {ASSISTANT_LANGUAGES.map((l) => (
                  <option key={l.code} value={l.code}>{l.label}</option>
                ))}
              </Select>
              <p className="mt-2 text-[11.5px] leading-relaxed text-slate-500">
                Hindi, Hinglish, Tamil, Telugu, Kannada, Bengali, Marathi and more — D understands
                core commands in each (Gnani.ai powers recognition when configured).
              </p>
            </div>
            <div>
              <Select
                label="Voice / accent (spoken replies)"
                value={settings.voice}
                disabled={!loaded}
                onChange={(e) => void save({ voice: e.target.value }).then((ok) => {
                  if (!ok) toast("error", "Could not save the voice.");
                })}
              >
                {ASSISTANT_VOICES.map((v) => (
                  <option key={v.id} value={v.id}>{v.label}</option>
                ))}
              </Select>
              <div className="mt-2">
                <Button size="sm" variant="secondary" loading={testing} icon={<Volume2 className="h-3.5 w-3.5" />} onClick={testVoice}>
                  Test voice
                </Button>
              </div>
            </div>
          </div>

          <div className="mt-6 rounded-2xl border border-mist-200 bg-mist-50 p-5">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-start gap-3">
                <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-electric-600/10">
                  <Eye className="h-4.5 w-4.5 text-electric-600" />
                </span>
                <div>
                  <p className="text-[14px] font-bold text-ink-900">
                    Speak sensitive values aloud
                  </p>
                  <p className="mt-1 max-w-lg text-[12.5px] leading-relaxed text-slate-500">
                    Off by default: Aadhaar, PAN and other sensitive values are always shown
                    <strong> masked</strong> and never spoken in full. Turn this on if you want D to
                    read sensitive values out loud when you ask for them (the screen stays masked).
                  </p>
                </div>
              </div>
              <button
                role="switch"
                aria-checked={settings.speakSensitive}
                aria-label="Speak sensitive values aloud"
                disabled={!loaded}
                onClick={() => void save({ speakSensitive: !settings.speakSensitive }).then((ok) => {
                  if (!ok) toast("error", "Could not save the setting.");
                })}
                className={`relative h-8 w-14 shrink-0 rounded-full border transition-colors ${
                  settings.speakSensitive
                    ? "border-electric-600 bg-electric-600"
                    : "border-mist-300 bg-mist-200"
                }`}
              >
                <span
                  className={`absolute top-0.5 h-6.5 w-6.5 rounded-full bg-white shadow transition-all ${
                    settings.speakSensitive ? "left-[28px]" : "left-0.5"
                  }`}
                  style={{ height: 26, width: 26 }}
                />
              </button>
            </div>
            {settings.speakSensitive && (
              <p className="mt-3 rounded-lg bg-blush-300/10 px-3.5 py-2.5 text-[12px] font-medium text-blush-400">
                Enabled — D will read sensitive values (like your Aadhaar number) out loud when you ask.
                Anyone nearby can hear them; use with care.
              </p>
            )}
          </div>
        </Card>

        {/* Chrome extension */}
        <Card className="p-7 sm:p-9">
          <div className="flex flex-wrap items-center justify-between gap-5">
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-electric-600/10">
                <Puzzle className="h-5 w-5 text-electric-600" />
              </span>
              <div>
                <h2 className="font-display text-[18px] font-bold text-ink-900">Chrome extension</h2>
                <p className="mt-1 text-[13.5px] text-slate-500">Pair the floating D button with this vault — just the server URL, no credentials.</p>
              </div>
            </div>
            <Button variant="secondary" size="lg" onClick={() => router.push("/extension-setup")}>Set up extension</Button>
          </div>
        </Card>

        {/* danger zone */}
        <Card className="border-red-200 p-7 sm:p-9">
          <div className="flex flex-wrap items-center justify-between gap-5">
            <div>
              <h2 className="flex items-center gap-2.5 font-display text-[18px] font-bold text-red-600">
                <Trash2 className="h-5 w-5" /> Danger zone
              </h2>
              <p className="mt-1.5 max-w-xl text-[13.5px] leading-relaxed text-slate-500">
                Permanently erase every profile, field, document (with its encrypted blob),
                application and receipt from this vault. The vault itself stays open and usable.
              </p>
            </div>
            <Button variant="danger" size="lg" onClick={() => setEraseOpen(true)}>
              Erase all vault data
            </Button>
          </div>
        </Card>
      </div>

      <ConfirmDialog
        open={eraseOpen}
        onClose={() => setEraseOpen(false)}
        onConfirm={eraseVault}
        loading={eraseBusy}
        title="Erase every record in this vault?"
        confirmLabel="Erase everything"
        danger
        body={
          <div className="space-y-3">
            <p>
              This deletes <strong>all</strong> profiles, encrypted fields, documents, screenshots,
              receipts and application history. It cannot be undone. Type{" "}
              <code className="rounded bg-mist-100 px-1.5 py-0.5 font-mono text-[12px]">ERASE-MY-VAULT</code> to confirm.
            </p>
            <Input
              label='Type "ERASE-MY-VAULT"'
              value={eraseConfirm}
              onChange={(e) => setEraseConfirm(e.target.value)}
              placeholder="ERASE-MY-VAULT"
            />
          </div>
        }
      />
    </div>
  );
}
