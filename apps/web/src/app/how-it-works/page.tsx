import type { Metadata } from "next";
import { MarketingShell } from "@/components/marketing/MarketingShell";
import { MousePointerClick, Mic, Eye, ThumbsUp, Send, Save, Database } from "lucide-react";

export const metadata: Metadata = { title: "How it works" };

const flow = [
  {
    phase: "Step 1 · Store",
    icon: Database,
    title: "Upload your information",
    body: "Create a personal profile, a business profile, or both. Add fields manually, upload documents (D runs OCR on your device and proposes extracted values for your review), or just tell D: “remember that my father's name is Rahul Sharma.”",
    points: ["Personal + business profiles", "Document OCR with review", "Voice capture to vault"],
  },
  {
    phase: "Step 2 · Activate",
    icon: MousePointerClick,
    title: "Click D on any website",
    body: "The Chrome extension places a floating D button on supported pages. It does nothing until you click it — no page inspection, no listening, nothing happens in the background.",
    points: ["activeTab + scripting permissions only", "No always-on listening", "No browsing history"],
  },
  {
    phase: "Step 3 · Fill",
    icon: Mic,
    title: "Speak and review",
    body: "Say “fill this application using my business profile.” D identifies the form's fields, maps each one to your vault with a confidence score, and shows a review panel. Sensitive values are masked in the panel; missing fields are flagged.",
    points: ["Confidence-scored mapping", "You approve every value", "D never clicks Submit"],
  },
  {
    phase: "Step 4 · Remember",
    icon: Save,
    title: "Save the application",
    body: "After you submit manually, say “D, save this application.” D stores the URL, website, date and reference number — plus a confirmation screenshot and receipt when you consent. Ask “what was my AWS reference number?” any time later.",
    points: ["Reference numbers & receipts", "Screenshot evidence (consent-gated)", "Voice retrieval later"],
  },
];

export default function HowItWorksPage() {
  return (
    <MarketingShell
      eyebrow="Workflow"
      title="From chaos to one voice"
      lead="Four steps that turn every application — grants, admissions, banking, visas, onboarding — into a thirty-second task."
    >
      <section className="mx-auto max-w-6xl px-5 py-16 sm:px-8">
        <ol className="space-y-6">
          {flow.map((s, i) => (
            <li key={s.title} className="grid gap-6 rounded-2xl border border-white/8 bg-ink-800/60 p-7 lg:grid-cols-[1fr_1.4fr] lg:gap-10">
              <div>
                <span className="text-[11px] font-bold tracking-[0.22em] text-blush-400">{s.phase}</span>
                <div className="mt-4 flex items-center gap-3">
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl border border-ice-300/20 bg-white/5">
                    <s.icon className="h-5 w-5 text-ice-300" />
                  </span>
                  <h2 className="display-2 text-xl text-white">{s.title}</h2>
                </div>
                <div className="mt-6 flex flex-wrap gap-2">
                  {s.points.map((p) => (
                    <span key={p} className="rounded-full border border-electric-600/30 bg-electric-600/10 px-3 py-1 text-[11.5px] font-semibold text-ice-300">
                      {p}
                    </span>
                  ))}
                </div>
              </div>
              <div className="flex items-start">
                <p className="text-[14px] leading-relaxed text-slate-400 lg:mt-8">
                  <span className="mr-3 font-display text-[26px] font-extrabold text-white/12">{String(i + 1).padStart(2, "0")}</span>
                  {s.body}
                </p>
              </div>
            </li>
          ))}
        </ol>

        <div className="mt-12 grid gap-4 rounded-2xl border border-electric-600/25 bg-electric-600/8 p-7 sm:grid-cols-3">
          {[
            { icon: Eye, t: "You always see what D understood", d: "Every voice command is transcribed and interpreted on screen before anything happens." },
            { icon: ThumbsUp, t: "You approve before anything is filled", d: "The review panel is the product's heart. No approval, no fill." },
            { icon: Send, t: "You always press Submit", d: "D populates fields. The final click is yours — always. CAPTCHAs and OTPs stay human." },
          ].map((x) => (
            <div key={x.t}>
              <x.icon className="h-5 w-5 text-ice-300" />
              <h3 className="mt-3 text-[14px] font-bold text-white">{x.t}</h3>
              <p className="mt-1.5 text-[12.5px] leading-relaxed text-slate-400">{x.d}</p>
            </div>
          ))}
        </div>
      </section>
    </MarketingShell>
  );
}
