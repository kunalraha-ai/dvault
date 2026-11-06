import type { Metadata } from "next";
import { MarketingShell } from "@/components/marketing/MarketingShell";
import { Card } from "@/components/ui/primitives";
import { DVaultWave } from "@/components/brand/DVaultWave";
import { Database, Mic, History, FileLock2, Puzzle, ShieldCheck, Layers, ScanText } from "lucide-react";

export const metadata: Metadata = { title: "Features" };

const featureGroups = [
  {
    icon: Database,
    title: "The Vault",
    items: [
      { t: "Personal vault", d: "Personal, family, identity, contact, education and employment information — every field with masking for sensitive values, verification, source tracking and last-updated." },
      { t: "Business vault", d: "A complete founder-mode workspace: company registration, founder profiles, product and traction, grant history — maintained separately from your personal profile." },
      { t: "Document vault", d: "Upload, categorize and preview documents. On-device OCR proposes structured fields that you review before anything is saved." },
    ],
  },
  {
    icon: Mic,
    title: "D, the voice assistant",
    items: [
      { t: "Gnani.ai voice engine", d: "Speech-to-text and spoken responses powered by Gnani — with multilingual support for Indian languages. Clean fallback when not configured." },
      { t: "Structured intents", d: "Every command becomes a structured intent — GET_PERSONAL_INFORMATION, FILL_ACTIVE_FORM, SAVE_APPLICATION — never a vague chat reply." },
      { t: "Voice-first, not voice-only", d: "Every voice action has a visible transcript, review step and a typed alternative. The microphone only starts when you click it." },
    ],
  },
  {
    icon: Puzzle,
    title: "Universal form filling",
    items: [
      { t: "Floating D button", d: "Activate D on any supported page. Nothing is inspected before you click — no always-on listening, no background scanning." },
      { t: "Confidence-scored mapping", d: "Labels, placeholders and input types are matched semantically against your vault. High-confidence fills are proposed; medium ones need your pick; low ones ask." },
      { t: "Review before fill", d: "A compact review panel shows every proposed value. Approve all, edit, exclude — then D fills. D never clicks Submit." },
    ],
  },
  {
    icon: History,
    title: "Application memory",
    items: [
      { t: "“D, save this application”", d: "After you submit, D saves the URL, website, submission date and reference number — with a confirmation screenshot and receipt if you approve." },
      { t: "Retrieve by voice", d: "“What was my startup grant reference number?” “Which applications are pending?” D answers from your saved history — never fabricating statuses." },
      { t: "Status history", d: "Track submissions, pending, approved and rejected — with an honest “unknown” until you update it yourself." },
    ],
  },
];

export default function FeaturesPage() {
  return (
    <MarketingShell
      eyebrow="Product"
      title="Everything D-Vault does"
      lead="A secure vault, a voice assistant, a universal form-filling engine and an application memory — designed as one product, not a bundle."
    >
      <section className="mx-auto max-w-6xl px-5 py-16 sm:px-8">
        <div className="grid gap-10">
          {featureGroups.map((g) => (
            <div key={g.title}>
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-ice-300/20 bg-white/5">
                  <g.icon className="h-5 w-5 text-ice-300" />
                </span>
                <h2 className="display-2 text-2xl text-white">{g.title}</h2>
              </div>
              <div className="mt-6 grid gap-4 md:grid-cols-3">
                {g.items.map((f) => (
                  <div key={f.t} className="rounded-2xl border border-white/8 bg-ink-800/60 p-6">
                    <h3 className="font-display text-[15px] font-bold text-white">{f.t}</h3>
                    <p className="mt-2 text-[13px] leading-relaxed text-slate-400">{f.d}</p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <Card className="mt-14 overflow-hidden border-0 bg-ink-950 p-0">
          <DVaultWave variant="panel" animated />
          <div className="grid gap-4 px-8 pb-10 sm:grid-cols-3">
            {[
              { icon: FileLock2, t: "Zero-knowledge cloud", d: "The server stores ciphertext it cannot read." },
              { icon: Layers, t: "Hybrid storage", d: "Encrypted local cache + encrypted cloud backup." },
              { icon: ScanText, t: "On-device OCR", d: "Text extraction happens in your browser." },
              { icon: ShieldCheck, t: "Minimal permissions", d: "activeTab + scripting, nothing broad." },
            ].map((x) => (
              <div key={x.t} className="rounded-xl border border-white/8 bg-ink-900/80 p-5">
                <x.icon className="h-4.5 w-4.5 text-bright-500" />
                <h4 className="mt-3 text-[13.5px] font-bold text-white">{x.t}</h4>
                <p className="mt-1 text-[12.5px] text-slate-400">{x.d}</p>
              </div>
            ))}
          </div>
        </Card>
      </section>
    </MarketingShell>
  );
}
