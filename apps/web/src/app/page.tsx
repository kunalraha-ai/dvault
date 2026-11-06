import Link from "next/link";
import type { Metadata } from "next";
import { ArrowRight } from "lucide-react";
import { GiantBellCurve } from "@/components/brand/GiantBellCurve";
import { LandingNav } from "@/components/landing/LandingNav";
import { ParallaxLayer } from "@/components/landing/Parallax";

export const metadata: Metadata = {
  title: "D-Vault — Your information. Every form. One voice.",
  description:
    "D-Vault is your secure, voice-powered personal information vault and universal form-filling assistant. Remember once, fill anywhere.",
};

/**
 * D-Vault landing — rebuilt from the provided design (Desktop.svg):
 *
 *   hero (curves + integrated headline) → 01 Remember (#090F21) →
 *   02 Fill (#060B1B, mapping card) → 03 Retrieve (light #F0F5FF,
 *   memory record) → finale (#091025, right-anchored curves)
 *
 * All colors, section heights, the bell-curve construction and the muted
 * third headline line come from that design.
 */

const INK_PAGE = "#060B1B";
const INK_A = "#090F21";
const INK_B = "#060B1B";
const INK_FINALE = "#091025";
const MUTED = "#9CABC9";

export default function LandingPage() {
  return (
    <div className="bg-[#060B1B] text-[#F0F5FF]">
      <LandingNav />

      {/* ================================================================
          HERO — the striped bell curves ARE the section
      ================================================================ */}
      <section className="relative flex h-[100svh] min-h-[660px] flex-col items-center justify-center overflow-hidden">
        <ParallaxLayer speed={0.16} className="absolute -inset-y-[14%] inset-x-0">
          <GiantBellCurve variant="hero" animated />
        </ParallaxLayer>

        {/* soft darkening behind the type so it sits IN the artwork */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 z-[5]"
          style={{
            background:
              "radial-gradient(ellipse 60% 42% at 50% 38%, rgba(6,11,27,0.72) 0%, rgba(6,11,27,0.28) 55%, transparent 78%)",
          }}
        />
        <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 z-[6] h-28 bg-gradient-to-b from-[#060B1B]/85 via-[#060B1B]/25 to-transparent" />

        <div className="relative z-10 px-6 text-center">
          {/* badge — pink dot + muted line, exactly as the design */}
          <p className="mb-9 flex items-center justify-center gap-2.5 text-[12.5px] font-semibold tracking-[0.02em] text-[#9CABC9]">
            <span aria-hidden className="h-[7px] w-[7px] bg-[#FA6EAB]" />
            Voice-first vault · universal form copilot · application memory
          </p>

          <h1 className="display-1 mx-auto max-w-5xl text-balance text-[clamp(2.9rem,7.4vw,5rem)] leading-[1.07]">
            Your information.
            <br />
            Every form.
            <br />
            <span className="text-[#9CABC9]">One voice.</span>
          </h1>

          {/* the design has no hero buttons — the nav pill carries the CTA */}
        </div>

        {/* scroll hint */}
        <p className="absolute bottom-8 left-1/2 z-10 -translate-x-1/2 text-[11.5px] font-medium tracking-[0.08em] text-[#9CABC9]/80">
          Scroll to explore the vault
        </p>
      </section>

      {/* ================================================================
          01 — REMEMBER  (#090F21)
      ================================================================ */}
      <section className="relative bg-[#090F21]">
        <div className="mx-auto grid max-w-[1220px] gap-16 px-6 py-24 sm:px-10 sm:py-32 lg:grid-cols-2 lg:gap-10">
          <div>
            <p className="text-[12px] font-bold tracking-[0.22em] text-[#5291FF]">
              01 — REMEMBER
            </p>
            <h2 className="display-2 mt-6 text-balance text-[clamp(2rem,4.2vw,3.4rem)] leading-[1.08] text-[#F0F5FF]">
              Your information,
              <br />
              securely stored.
            </h2>
            <p className="display-2 mt-5 text-balance text-[clamp(1.35rem,2.6vw,2.1rem)] leading-[1.2] font-extrabold tracking-tight text-[#9CABC9]">
              Personal, business, and everything a form will ever ask you for.
            </p>
          </div>

          <div className="flex flex-col justify-center gap-10 lg:pl-10">
            <p className="text-[15.5px] font-medium leading-relaxed text-[#F0F5FF]">
              Say it once — D keeps it encrypted forever.
            </p>
            {[
              ["PERSONAL VAULT", "Family, identity, contact, education and employment — every field encrypted, masked and verifiable."],
              ["BUSINESS VAULT", "Company, founders, product and traction — kept separate from your personal life."],
              ["DOCUMENTS", "OCR runs on your device. D proposes fields; you review before anything is saved."],
            ].map(([label, body]) => (
              <div key={label}>
                <p className="text-[12px] font-bold tracking-[0.18em] text-[#5291FF]">{label}</p>
                <p className="mt-2 max-w-[46ch] text-[14.5px] leading-relaxed text-[#F0F5FF]/90">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ================================================================
          02 — FILL  (#060B1B) with the mapping demo card
      ================================================================ */}
      <section className="relative bg-[#060B1B]">
        <div className="mx-auto grid max-w-[1220px] gap-16 px-6 py-24 sm:px-10 sm:py-32 lg:grid-cols-2 lg:gap-10">
          <div>
            <p className="text-[12px] font-bold tracking-[0.22em] text-[#FA6EAB]">
              02 — FILL
            </p>
            <h2 className="display-2 mt-6 text-balance text-[clamp(2rem,4.2vw,3.4rem)] leading-[1.08] text-[#F0F5FF]">
              Your forms,
              <br />
              intelligently completed.
            </h2>
            <p className="display-2 mt-5 text-balance font-extrabold tracking-tight text-[#9CABC9] text-[clamp(1.2rem,2.2vw,1.75rem)] leading-[1.25]">
              Confidence-scored mapping against your own encrypted vault.
            </p>
            <p className="mt-8 max-w-md text-[14px] leading-relaxed text-[#9CABC9]/80">
              Click the floating D on any page — nothing is inspected until you
              do. You approve every field, and you press Submit. Always.
            </p>
          </div>

          {/* the mapping card — header bar + 4 rows, as in the design */}
          <div className="lg:pl-6">
            <div className="overflow-hidden rounded-2xl bg-[#131F3B]">
              <div className="flex h-14 items-center px-6">
                <p className="text-[12px] font-semibold tracking-[0.14em] text-[#9CABC9]">
                  D MAPPING — MOCK GRANT APPLICATION
                </p>
              </div>
              <div className="space-y-2.5 rounded-2xl bg-[#060B1B] p-4">
                {[
                  ["Applicant full name", "personal.full_name", "98%"],
                  ["Registered company name", "business.company_name", "97%"],
                  ["Founder LinkedIn profile", "business.founder_linkedin", "96%"],
                  ["Annual recurring revenue (₹)", "business.arr", "95%"],
                ].map(([field, key, conf]) => (
                  <div key={field} className="flex items-center gap-4 rounded-lg bg-[#142140] px-5 py-3">
                    <span className="min-w-0 flex-1 truncate text-[12.5px] text-[#9CABC9]">
                      “{field}” <span className="text-[#5291FF]/60">→</span>{" "}
                      <span className="font-mono text-[#F0F5FF]">{key}</span>
                    </span>
                    <span className="flex shrink-0 items-center gap-2">
                      <span className="text-[11px] font-bold text-[#F0F5FF]/70">{conf}</span>
                      <span aria-hidden className="h-2 w-2 bg-[#FA6EAB]" />
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ================================================================
          03 — RETRIEVE  (light #F0F5FF) with the memory record
      ================================================================ */}
      <section className="relative bg-[#F0F5FF]">
        <div className="mx-auto grid max-w-[1220px] gap-16 px-6 py-24 sm:px-10 sm:py-28 lg:grid-cols-2 lg:gap-10">
          <div>
            <p className="text-[12px] font-bold tracking-[0.22em] text-[#2657BF]">
              03 — RETRIEVE
            </p>
            <h2 className="display-2 mt-6 text-balance text-[clamp(2rem,4.2vw,3.4rem)] leading-[1.08] text-[#090E21]">
              Your applications,
              <br />
              always remembered.
            </h2>
            <p className="display-2 mt-5 text-balance font-extrabold tracking-tight text-[#4F5C78] text-[clamp(1.15rem,2.1vw,1.6rem)] leading-[1.3]">
              “D, save this application.” — reference numbers, URLs,
              screenshots and receipts, on call forever.
            </p>
          </div>

          {/* memory record block */}
          <div className="lg:pl-10">
            <p className="text-[12px] font-bold tracking-[0.18em] text-[#4061B3]">
              AWS FOR STARTUPS
            </p>
            <p className="mt-2 font-display text-[22px] font-extrabold tracking-tight text-[#0A1229]">
              AWS-SUP-2026-88421
            </p>
            <div className="mt-7 space-y-5">
              <div>
                <p className="text-[11.5px] font-semibold uppercase tracking-wide text-[#6B788F]">
                  Bharat Innovate Grant
                </p>
                <p className="mt-1 font-mono text-[13.5px] text-[#33425E]">
                  BIG-2026-88421 · pending
                </p>
              </div>
              <div>
                <p className="text-[11.5px] font-semibold uppercase tracking-wide text-[#6B788F]">
                  University admission (MTech)
                </p>
                <p className="mt-1 font-mono text-[13.5px] text-[#33425E]">
                  ADM-2026-30012 · submitted
                </p>
              </div>
            </div>
            <span className="mt-8 inline-flex items-center rounded-full bg-[#E8F2FF] px-4 py-2 text-[11px] font-bold text-[#2657BF]">
              fictional examples
            </span>
          </div>
        </div>
      </section>

      {/* ================================================================
          FINALE (#091025) — pink eyebrow, headline, pill, right curves
      ================================================================ */}
      <section className="relative overflow-hidden bg-[#091025]">
        <div aria-hidden className="relative z-10 mx-auto max-w-[1220px] px-6 pt-16 sm:px-10">
          <div className="h-px w-full bg-[#405C94]/45" />
        </div>

        {/* the right-anchored curves — spanning the full section, per the design */}
        <ParallaxLayer speed={-0.08} className="pointer-events-none absolute inset-0">
          <GiantBellCurve variant="finale" animated />
        </ParallaxLayer>

        <div className="relative z-10 mx-auto max-w-[1220px] px-6 pb-40 pt-16 sm:px-10 sm:pb-48 sm:pt-20">
          <div className="max-w-[46%]">
            <p className="text-[12px] font-bold tracking-[0.22em] text-[#FA6EAB]">
              THE END OF RE-TYPING
            </p>
            <h2 className="display-1 mt-6 text-balance text-[clamp(2.6rem,5.6vw,4.4rem)] leading-[1.05] text-[#F0F5FF]">
              Stop re-entering
              <br />
              your life.
            </h2>
            <p className="mt-6 text-[15px] font-medium leading-relaxed text-[#9CABC9]">
              Enter once. Reuse everywhere. Remember everything.
            </p>
            <Link
              href="/dashboard"
              className="group mt-10 inline-flex h-12 items-center gap-2.5 rounded-full bg-[#2E6EFA] px-8 text-[14px] font-bold text-[#F0F5FF] shadow-[0_16px_44px_-12px_rgba(46,110,250,0.7)] transition hover:bg-[#5291FF]"
            >
              Meet D-Vault
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
          </div>
        </div>

        {/* footer row */}
        <div className="relative z-10 mx-auto flex max-w-[1220px] items-center justify-between border-t border-[#405C94]/25 px-6 py-8 sm:px-10">
          <p className="font-display text-[13px] font-extrabold tracking-tight text-[#F0F5FF]">
            D-VAULT
          </p>
          <p className="text-[12px] text-[#9CABC9]">
            Your information. Every form. One voice.
          </p>
        </div>
      </section>
    </div>
  );
}
