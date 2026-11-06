"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Search, Plus, ExternalLink, Trash2, Eye, EyeOff, Copy, Globe, CalendarClock } from "lucide-react";
import { Button, Card, Badge, EmptyState, Skeleton } from "@/components/ui/primitives";
import { ConfirmDialog } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { useVaultSession } from "@/lib/client/vault-session";
import { APPLICATION_STATUSES, type ApplicationStatus } from "@/lib/core";

interface AppRow {
  id: string; applicationName: string; websiteDomain: string; applicationUrl: string;
  encryptedReferenceId: { c: string; iv: string } | null; submissionDate: string | null;
  status: string; isDemo: boolean; profileName: string | null; createdAt: string;
}
interface Stats { total: number; submitted: number; pending: number; approved: number; rejected: number }

const STATUS_TONES: Record<string, "blue" | "green" | "amber" | "red" | "gray"> = {
  submitted: "blue", pending: "amber", approved: "green", rejected: "red",
  unknown: "gray", draft: "gray",
};

export default function ApplicationsPage() {
  const session = useVaultSession();
  const { toast } = useToast();
  const router = useRouter();
  const [apps, setApps] = useState<AppRow[] | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [refs, setRefs] = useState<Record<string, string>>({});
  const [reveal, setReveal] = useState<Record<string, boolean>>({});
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | ApplicationStatus>("all");
  const [sort, setSort] = useState<"date" | "name" | "website" | "status">("date");
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!session) return;
    const res = await fetch("/api/applications", { credentials: "include" });
    const data = (await res.json()) as { applications: AppRow[]; stats: Stats };
    setApps(data.applications);
    setStats(data.stats);
    const dec: Record<string, string> = {};
    for (const a of data.applications) {
      if (a.encryptedReferenceId) {
        try { dec[a.id] = await session.decrypt(a.encryptedReferenceId); } catch { dec[a.id] = "(cannot decrypt)"; }
      }
    }
    setRefs(dec);
  }, [session]);

  useEffect(() => { load(); }, [load]);

  async function remove(id: string) {
    const res = await fetch(`/api/applications/${id}`, { method: "DELETE", credentials: "include" });
    if (res.ok) {
      toast("success", "Application record deleted.");
      setDeleteId(null);
      load();
    } else toast("error", "Could not delete the record.");
  }

  const filtered = (apps ?? []).filter((a) => {
    if (statusFilter !== "all" && a.status !== statusFilter) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return (
        a.applicationName.toLowerCase().includes(q) ||
        a.websiteDomain.toLowerCase().includes(q) ||
        (refs[a.id] ?? "").toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <div className="mx-auto max-w-6xl px-5 py-8 sm:px-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="display-2 text-[28px] text-ink-900">My applications</h1>
          <p className="mt-1 text-[13.5px] text-slate-500">
            Everything you applied for — references, URLs, receipts — saved only when you say so.
          </p>
        </div>
        <Button icon={<Plus className="h-4 w-4" />} onClick={() => {
          // quick-add via prompt-based modal-less flow for MVP
          const name = window.prompt("Application name (e.g. “AWS for Startups application”)");
          if (!name) return;
          const domain = window.prompt("Website domain", "example.test") ?? "example.test";
          const url = window.prompt("Application URL", `https://${domain}`) ?? `https://${domain}`;
          const ref = window.prompt("Reference / acknowledgement ID (optional)", "") ?? "";
          (async () => {
            const enc = ref ? await session?.encrypt(ref) : null;
            const res = await fetch("/api/applications", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              credentials: "include",
              body: JSON.stringify({
                applicationName: name, websiteDomain: domain,
                applicationUrl: url.startsWith("http") ? url : `https://${url}`,
                encryptedReferenceId: enc ?? null, submissionDate: new Date().toISOString(),
                status: "submitted",
              }),
            });
            if (res.ok) { toast("success", "Application saved."); load(); }
            else toast("error", "Could not save the application.");
          })();
        }}>
          Save an application
        </Button>
      </div>

      {/* stats */}
      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-5">
        {[
          { label: "Total", value: stats?.total, tone: "text-ink-900" },
          { label: "Submitted", value: stats?.submitted, tone: "text-electric-600" },
          { label: "Pending", value: stats?.pending, tone: "text-amber-500" },
          { label: "Approved", value: stats?.approved, tone: "text-emerald-500" },
          { label: "Rejected", value: stats?.rejected, tone: "text-red-500" },
        ].map((s) => (
          <Card key={s.label} className="px-4 py-3.5">
            <p className="text-[11.5px] font-semibold uppercase tracking-wide text-slate-400">{s.label}</p>
            <p className={`mt-1 font-display text-[24px] font-extrabold ${s.tone}`}>{s.value ?? 0}</p>
          </Card>
        ))}
      </div>

      {/* search / filter / sort */}
      <div className="mt-5 flex flex-wrap items-center gap-3">
        <div className="relative min-w-[220px] flex-1">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            aria-label="Search applications"
            placeholder="Search by name, website or reference…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-10 w-full rounded-xl border border-mist-200 bg-white pl-10 pr-4 text-[14px] focus:outline-none focus:ring-2 focus:ring-bright-500/40"
          />
        </div>
        <div className="flex gap-1.5 overflow-x-auto">
          <select
            aria-label="Filter by status"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
            className="h-8 rounded-full border border-mist-200 bg-white px-3 text-[12.5px] font-semibold text-slate-600"
          >
            <option value="all">All statuses</option>
            {APPLICATION_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <select
            aria-label="Sort"
            value={sort}
            onChange={(e) => { setSort(e.target.value as typeof sort); const params = new URLSearchParams({ sort: e.target.value }); fetch(`/api/applications?${params}`, { credentials: "include" }).then(r => r.json()).then(d => setApps(d.applications)); }}
            className="h-8 rounded-full border border-mist-200 bg-white px-3 text-[12.5px] font-semibold text-slate-600"
          >
            <option value="date">Sort: newest</option>
            <option value="name">Sort: name</option>
            <option value="website">Sort: website</option>
            <option value="status">Sort: status</option>
          </select>
        </div>
      </div>

      {/* list */}
      <div className="mt-5">
        {apps === null ? (
          <div className="space-y-3"><Skeleton className="h-20 w-full" /><Skeleton className="h-20 w-full" /></div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={<CalendarClock className="h-8 w-8" />}
            title={apps.length ? "No applications match" : "No applications saved yet"}
            description={apps.length
              ? "Try clearing the search or filter."
              : "After you submit a form anywhere, open the page with the Chrome extension, click D and say “save this application” — the URL, reference number and receipt land here."}
          />
        ) : (
          <Card className="divide-y divide-mist-100 p-0">
            {filtered.map((a) => {
              const ref = refs[a.id];
              const hidden = ref && !reveal[a.id];
              return (
                <div key={a.id} className="group flex items-center gap-4 px-5 py-4 transition hover:bg-mist-50/60">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link href={`/applications/${a.id}`} className="truncate text-[14px] font-semibold text-ink-900 hover:text-electric-600">
                        {a.applicationName}
                      </Link>
                      <Badge tone={STATUS_TONES[a.status] ?? "gray"}>{a.status}</Badge>
                      {a.isDemo && <Badge tone="pink">Fictional</Badge>}
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11.5px] text-slate-400">
                      <span className="flex items-center gap-1"><Globe className="h-3 w-3" />{a.websiteDomain}</span>
                      {a.submissionDate && (
                        <span className="flex items-center gap-1"><CalendarClock className="h-3 w-3" />{new Date(a.submissionDate).toLocaleDateString()}</span>
                      )}
                    </div>
                    {ref && (
                      <div className="mt-1.5 flex items-center gap-2">
                        <code className={`rounded bg-mist-100 px-2 py-0.5 text-[11.5px] ${hidden ? "text-slate-400" : "text-ink-800"}`}>
                          {hidden ? "••••••••" + ref.slice(-3) : ref}
                        </code>
                        <button aria-label={hidden ? "Reveal reference" : "Hide reference"} onClick={() => setReveal((r) => ({ ...r, [a.id]: !r[a.id] }))} className="text-slate-400 hover:text-ink-700">
                          {hidden ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                        </button>
                        <button aria-label="Copy reference" onClick={() => { navigator.clipboard.writeText(ref); toast("success", "Reference copied."); }} className="text-slate-400 hover:text-ink-700">
                          <Copy className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-0.5 opacity-0 transition group-hover:opacity-100">
                    <a href={a.applicationUrl} target="_blank" rel="noopener noreferrer" aria-label="Open original" title="Open original" className="rounded-lg p-2 text-slate-400 hover:bg-mist-100 hover:text-ink-700">
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                    <button aria-label="Delete" title="Delete" onClick={() => setDeleteId(a.id)} className="rounded-lg p-2 text-red-400 hover:bg-red-50">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </Card>
        )}
      </div>

      <ConfirmDialog
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={() => deleteId && remove(deleteId)}
        title="Delete this application record?"
        body="The record, its status history and any encrypted screenshots/receipts are removed permanently."
        confirmLabel="Delete"
        danger
      />
    </div>
  );
}
