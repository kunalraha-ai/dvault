"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { DBadge } from "@/components/brand/DBadge";

const LINKS = [
  { label: "Product", href: "#product" },
  { label: "How it Works", href: "#how" },
  { label: "Security", href: "#security" },
];

/**
 * LandingNav — transparent over the artwork; only after leaving the hero does
 * a whisper of glass appear (never a large solid bar). There is no sign-in —
 * the product opens directly.
 */
export function LandingNav() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 80);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 transition-all duration-500 ${
        scrolled
          ? "border-b border-white/[0.06] bg-[#04060F]/80 backdrop-blur-md"
          : "border-b border-transparent bg-transparent"
      }`}
    >
      <nav className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5 sm:px-8">
        <Link href="/" aria-label="D-Vault home" className="flex items-center gap-2.5">
          <DBadge size={32} />
          <span className="font-display text-[15px] font-extrabold tracking-tight text-white">
            D-VAULT
          </span>
        </Link>

        <div className="hidden items-center gap-9 text-[13.5px] font-medium text-slate-400 md:flex">
          {LINKS.map((l) => (
            <a key={l.href} href={l.href} className="transition hover:text-white">
              {l.label}
            </a>
          ))}
        </div>

        <Link
          href="/dashboard"
          className="rounded-xl bg-[#2E6EFA] px-5 py-2.5 text-[13px] font-bold text-[#F0F5FF] transition hover:bg-[#5291FF]"
        >
          Open App
        </Link>
      </nav>
    </header>
  );
}
