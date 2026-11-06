import type { Metadata } from "next";
import { MarketingShell } from "@/components/marketing/MarketingShell";
import { DVaultWave } from "@/components/brand/DVaultWave";
import { Lock, KeyRound, MousePointerClick, Eye, Mic, FileLock2, ShieldAlert, Fingerprint } from "lucide-react";

export const metadata: Metadata = { title: "Security & Privacy" };

const controls = [
  {
    icon: Lock,
    title: "Client-side encryption at rest",
    body: "Sensitive vault values, extracted document text, reference numbers and attachments are encrypted with AES-256-GCM before they are ever sent. The server stores only {ciphertext, iv} envelopes.",
  },
  {
    icon: KeyRound,
    title: "No accounts, no passwords",
    body: "D-Vault runs in single-user local mode: no sign-up, no login, no sessions to hijack. An AES-256 instance key is generated once on your own server; values stay encrypted end-to-end and the vault opens directly.",
  },
  {
    icon: FileLock2,
    title: "Encrypted document storage",
    body: "Documents, screenshots and receipts are stored under opaque random keys. There are no public file URLs — downloads stream through owner-checked routes.",
  },
  {
    icon: MousePointerClick,
    title: "User-controlled activation",
    body: "D inspects nothing until you click the floating D button. The extension requests only activeTab + scripting permissions — no broad host access, no background surveillance, no browsing-history collection.",
  },
  {
    icon: Eye,
    title: "Visual confirmation & scoped retrieval",
    body: "D never sends your whole vault to an LLM — mapping runs on your device against a fixed lexicon, and only the specific fields approved for a task are fetched. Website text is untrusted input and can never alter D's rules.",
  },
  {
    icon: Mic,
    title: "Voice privacy",
    body: "The microphone starts only on your click. Transcripts of commands stay on your screen. Sensitive values are shown masked instead of spoken in full, and OTPs are never stored, logged or included in memory.",
  },
  {
    icon: Fingerprint,
    title: "Revocable device identity",
    body: "Paired extensions get revocable device tokens that exist for the consent log and the Security Center — they are not accounts, and one click unpairs them.",
  },
  {
    icon: ShieldAlert,
    title: "Honest boundaries",
    body: "In no-account local mode the instance key is held by your self-hosted server — encryption protects the stored data (and DB-only leaks), not against the server itself. Rate limiting is in-memory per process. Automated application-status tracking is deliberately absent.",
  },
];

export default function SecurityPage() {
  return (
    <MarketingShell
      eyebrow="Security & privacy"
      title="Trust is the architecture"
      lead="D-Vault is built zero-knowledge where it matters and explicit-permission everywhere else. Here is exactly what is implemented — and what is honestly not."
    >
      <section className="mx-auto max-w-6xl px-5 py-16 sm:px-8">
        <div className="grid gap-4 md:grid-cols-2">
          {controls.map((c) => (
            <div key={c.title} className="rounded-2xl border border-white/8 bg-ink-800/60 p-6">
              <c.icon className="h-5 w-5 text-bright-500" />
              <h2 className="mt-3 font-display text-[15px] font-bold text-white">{c.title}</h2>
              <p className="mt-2 text-[13px] leading-relaxed text-slate-400">{c.body}</p>
            </div>
          ))}
        </div>

        <div className="mt-12 overflow-hidden rounded-2xl border border-white/10">
          <DVaultWave variant="panel" animated />
          <div className="bg-ink-950 px-8 pb-9 text-center">
            <h3 className="display-2 text-xl text-white">Open by design — read this honestly</h3>
            <p className="mx-auto mt-3 max-w-2xl text-[13.5px] leading-relaxed text-slate-400">
              D-Vault has no accounts or logins: it is built for a single user on their own
              machine or server. Every value is still encrypted with AES-256-GCM before
              storage, but in this mode the instance key is held by your self-hosted server —
              so encryption protects the stored data against DB-only leaks, not against the
              server itself. If you need zero-knowledge (the server can never decrypt),
              bind D-Vault to localhost or a private network, and see docs/SECURITY.md for
              the full model.
            </p>
          </div>
        </div>
      </section>
    </MarketingShell>
  );
}
