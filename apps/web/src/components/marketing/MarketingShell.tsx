import Link from "next/link";
import { DVaultLogo } from "@/components/brand/DBadge";

export function MarketingShell({
  children,
  eyebrow,
  title,
  lead,
}: {
  children: React.ReactNode;
  eyebrow: string;
  title: string;
  lead: string;
}) {
  return (
    <div className="min-h-screen bg-ink-900 text-ice-200">
      <header className="border-b border-white/5">
        <nav className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5 sm:px-8">
          <Link href="/"><DVaultLogo /></Link>
          <Link href="/dashboard" className="rounded-xl bg-electric-600 px-4 py-2 text-[13.5px] font-semibold text-white transition hover:bg-bright-500">
            Open D-Vault
          </Link>
        </nav>
      </header>

      <main>
        <section className="border-b border-white/5 bg-ink-950 px-5 py-16 sm:px-8 sm:py-20">
          <div className="mx-auto max-w-6xl">
            <p className="eyebrow text-blush-400">{eyebrow}</p>
            <h1 className="display-2 mt-3 max-w-3xl text-4xl text-white sm:text-5xl">{title}</h1>
            <p className="mt-5 max-w-2xl text-[15px] leading-relaxed text-slate-400">{lead}</p>
          </div>
        </section>
        {children}
      </main>

      <footer className="border-t border-white/5 bg-ink-950 py-10">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-5 sm:px-8 md:flex-row">
          <DVaultLogo />
          <p className="text-[12.5px] text-slate-500">Enter once. Reuse everywhere. Remember everything.</p>
        </div>
      </footer>
    </div>
  );
}
