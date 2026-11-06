"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Puzzle, Download, KeyRound, ShieldCheck, Check, MousePointerClick, ArrowRight } from "lucide-react";
import { Button, Card, Badge } from "@/components/ui/primitives";
import { DVaultWave } from "@/components/brand/DVaultWave";

export default function ExtensionSetupPage() {
  const [serverUrl, setServerUrl] = useState("");

  useEffect(() => {
    setServerUrl(window.location.origin);
  }, []);

  return (
    <div className="mx-auto max-w-4xl px-5 py-8 sm:px-8">
      <div className="overflow-hidden rounded-2xl border border-mist-200">
        <div className="relative">
          <DVaultWave variant="strip" animated />
          <div className="pointer-events-none absolute inset-0 z-10 flex flex-col justify-center px-6 sm:px-8">
            <h1 className="display-2 text-[24px] text-white sm:text-[28px]">Chrome extension setup</h1>
            <p className="mt-1 max-w-lg text-[13px] text-slate-300">
              One floating D button. Nothing on any page is inspected until you click it.
            </p>
          </div>
          <div className="h-[120px] sm:h-[140px]" aria-hidden />
        </div>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-[1.4fr_1fr]">
        {/* steps */}
        <Card className="p-6">
          <h2 className="font-display text-[15px] font-bold text-ink-900">Install (Load unpacked)</h2>
          <ol className="mt-4 space-y-4">
            {[
              {
                icon: Download,
                title: "Build the extension",
                body: <>From the repo root run <code className="rounded bg-mist-100 px-1.5 py-0.5 font-mono text-[12px]">npm run build:extension</code>. The loadable bundle appears at <code className="rounded bg-mist-100 px-1.5 py-0.5 font-mono text-[12px]">apps/extension/dist/</code>.</>,
              },
              {
                icon: Puzzle,
                title: "Open Chrome's extension page",
                body: <>Visit <code className="rounded bg-mist-100 px-1.5 py-0.5 font-mono text-[12px]">chrome://extensions</code>, enable <strong>Developer mode</strong> (top-right), and click <strong>Load unpacked</strong>.</>,
              },
              {
                icon: Check,
                title: "Select the dist folder",
                body: <>Choose <code className="rounded bg-mist-100 px-1.5 py-0.5 font-mono text-[12px]">apps/extension/dist</code>. The D-Vault extension appears with only <Badge tone="blue">activeTab</Badge> and <Badge tone="blue">scripting</Badge> permissions — no broad host access.</>,
              },
              {
                icon: KeyRound,
                title: "Pair it with your vault",
                body: <>Open any page and click the D-Vault toolbar icon. Enter this server URL (<code className="rounded bg-mist-100 px-1.5 py-0.5 font-mono text-[12px]">{serverUrl || "http://localhost:3000"}</code>) and click <strong>Connect</strong> — no account, no credentials. Pairing registers a revocable device identity and receives the instance key so values decrypt only on this device.</>,
              },
              {
                icon: MousePointerClick,
                title: "Click D on any form page",
                body: <>Click the toolbar D (or the floating button after activation) on a page with a form. Say <em>“D, fill this form with my business profile.”</em> Review, approve, submit manually.</>,
              },
            ].map((s, i) => (
              <li key={s.title} className="flex gap-4">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-electric-600/10 text-electric-600">
                  <s.icon className="h-4.5 w-4.5" />
                </span>
                <div>
                  <p className="text-[14px] font-bold text-ink-900">
                    <span className="mr-2 text-slate-300">{String(i + 1).padStart(2, "0")}</span>
                    {s.title}
                  </p>
                  <p className="mt-1 text-[13px] leading-relaxed text-slate-500">{s.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </Card>

        {/* security card */}
        <div className="space-y-4">
          <Card className="p-6">
            <h3 className="flex items-center gap-2 font-display text-[14px] font-bold text-ink-900">
              <ShieldCheck className="h-4 w-4 text-emerald-500" /> Permission model
            </h3>
            <ul className="mt-3 space-y-2.5 text-[12.5px] leading-relaxed text-slate-600">
              <li className="flex gap-2"><Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-500" /><span><strong>activeTab</strong> — access only the tab where you clicked D.</span></li>
              <li className="flex gap-2"><Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-500" /><span><strong>scripting</strong> — inject the inspector/UI on that click.</span></li>
              <li className="flex gap-2"><Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-500" /><span>No inspection on page load. No background page reading. No browsing history.</span></li>
              <li className="flex gap-2"><Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-500" /><span>Screenshots only with a per-save consent dialog.</span></li>
              <li className="flex gap-2"><Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-500" /><span>Optional “always show floating button” mode uses opt-in host permissions, off by default.</span></li>
            </ul>
          </Card>

          <Card className="p-6">
            <h3 className="font-display text-[14px] font-bold text-ink-900">Try the mock site</h3>
            <p className="mt-2 text-[12.5px] leading-relaxed text-slate-500">
              Test the full flow on D-Vault's own mock grant application — dozens of field types,
              including deliberately unsupported widgets.
            </p>
            <div className="mt-3 space-y-2">
              <a href="/demo/grant-application.html" target="_blank" rel="noopener noreferrer">
                <Button variant="secondary" size="sm" className="w-full justify-between">
                  Mock grant application <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              </a>
              <a href="/demo/bank-kyc.html" target="_blank" rel="noopener noreferrer">
                <Button variant="secondary" size="sm" className="w-full justify-between">
                  Mock bank KYC (personal) <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              </a>
            </div>
          </Card>
        </div>
      </div>

      <p className="mt-5 text-[12px] text-slate-400">
        Full walkthrough: <Link href="/how-it-works" className="font-semibold text-electric-600 hover:underline">How it works</Link> · Architecture details in <code className="font-mono">docs/EXTENSION_GUIDE.md</code>
      </p>
    </div>
  );
}
