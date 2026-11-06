"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Plus, FileUp, Mic, History, Puzzle, Database, Building2, User, FileCheck2,
  Clock3, Sparkles, ArrowRight, CircleAlert, CloudCheck, Hourglass,
} from "lucide-react";
import { DVaultWave } from "@/components/brand/DVaultWave";
import { Button, Card, Skeleton, EmptyState, Badge } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";
import { useVaultSession } from "@/lib/client/vault-session";
import { loadDemoData } from "@/lib/client/demo-data";
import { FIELDS, fieldsForProfile } from "@/lib/core";

interface ProfileSummary {
  id: string; profileType: string; profileName: string; fieldCount: number;
  documentCount: number; applicationCount: number; verifiedFieldCount: number;
}
interface AppSummary {
  id: string; applicationName: string; websiteDomain: string; status: string;
  isDemo: boolean; createdAt: string; submissionDate: string | null;
}
interface DashboardData {
  profiles: ProfileSummary[];
  apps: AppSummary[];
  appStats: { total: number; submitted: number; pending: number };
  documents: { id: string; filename: string; category: string; createdAt: string }[];
}

export default function DashboardPage() {
  const session = useVaultSession();
  const { toast } = useToast();
  const router = useRouter();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [demoLoading, setDemoLoading] = useState(false);
  const [lastSynced, setLastSynced] = useState<string | null>(null);
  const [hour, setHour] = useState<number>(new Date().getHours());

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [pRes, aRes, dRes, sRes] = await Promise.all([
        fetch("/api/profiles", { credentials: "include" }),
        fetch("/api/applications", { credentials: "include" }),
        fetch("/api/documents", { credentials: "include" }),
        fetch("/api/security/sessions", { credentials: "include" }),
      ]);
      const profiles = (await pRes.json()).profiles as ProfileSummary[];
      const aJson = await aRes.json();
      const documents = (await dRes.json()).documents as DashboardData["documents"];
      const sync = (await sRes.json()) as { sync?: { lastSyncedAt: string }[] };
      setLastSynced(sync.sync?.[0]?.lastSyncedAt ?? null);
      setData({
        profiles,
        apps: aJson.applications as AppSummary[],
        appStats: aJson.stats,
        documents,
      });
    } catch {
      toast("error", "Could not load your dashboard data.");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  async function seedDemo() {
    if (!session) return;
    setDemoLoading(true);
    try {
      const result = await loadDemoData(session.encrypt);
      toast("success", `Loaded fictional demo data: ${result.createdProfiles} profiles, ${result.createdFields} fields, ${result.createdApplications} applications.`);
      await load();
      router.refresh();
    } catch {
      toast("error", "Could not load the demo data.");
    } finally {
      setDemoLoading(false);
    }
  }

  const personal = data?.profiles.find((p) => p.profileType === "personal");
  const business = data?.profiles.find((p) => p.profileType === "business");
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const firstName = (session?.user.name ?? "there").split(" ")[0];
  const totalDocs = data?.documents.length ?? 0;
  const personalCompletion = personal
    ? Math.round((personal.fieldCount / fieldsForProfile("personal").length) * 100)
    : 0;
  const businessCompletion = business
    ? Math.round((business.fieldCount / fieldsForProfile("business").length) * 100)
    : 0;
  const isEmpty =
    data && data.profiles.length === 0 && data.apps.length === 0 && data.documents.length === 0;

  return (
    <div>
      {/* ================= HERO ================= */}
      <section className="relative overflow-hidden">
        <DVaultWave variant="strip" animated fill className="absolute inset-0 h-full w-full" />
        <div className="pointer-events-none relative z-10 mx-auto max-w-6xl px-5 py-14 sm:px-8">
          <p className="text-[12.5px] font-semibold tracking-wide text-ice-300/80">
            {greeting}, {firstName}.
          </p>
          <h1 className="display-2 mt-1.5 max-w-xl text-3xl text-white sm:text-[38px]">
            Your information is ready whenever you need it.
          </h1>
          <div className="mt-6 flex flex-wrap gap-2.5">
            <Button size="md" variant="outline-dark" onClick={() => router.push("/vault/personal")} icon={<Plus className="h-4 w-4" />}>
              Add information
            </Button>
            <Button size="md" variant="outline-dark" onClick={() => router.push("/assistant")} icon={<Mic className="h-4 w-4" />}>
              Talk to D
            </Button>
          </div>
        </div>
        <div className="relative z-10 h-[186px]" aria-hidden />
      </section>

      <div className="mx-auto max-w-6xl px-5 pb-16 pt-8 sm:px-8">
        {/* ================= DEMO EMPTY STATE ================= */}
        {isEmpty && !loading && (
          <Card className="mb-8 border-dashed bg-white p-6">
            <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-electric-600/10">
                <Sparkles className="h-5 w-5 text-electric-600" />
              </span>
              <div className="flex-1">
                <h3 className="font-display text-[15px] font-bold text-ink-900">Try the full experience with fictional demo data</h3>
                <p className="mt-1 text-[13px] leading-relaxed text-slate-500">
                  Loads a fictional founder profile (Aarav Mehta) and company (NovaStack Technologies)
                  plus demo applications — all encrypted through the real pipeline and clearly
                  labelled as fiction. You can delete everything from Settings at any time.
                </p>
              </div>
              <Button loading={demoLoading} onClick={seedDemo} className="shrink-0">
                Load demo data
              </Button>
            </div>
          </Card>
        )}

        {/* ================= OVERVIEW CARDS ================= */}
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {/* Vault overview */}
          <Card className="p-5">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-[14px] font-bold text-ink-900">Vault overview</h2>
              <Database className="h-4 w-4 text-slate-300" />
            </div>
            {loading ? (
              <div className="mt-4 space-y-3"><Skeleton className="h-9 w-full" /><Skeleton className="h-9 w-full" /><Skeleton className="h-9 w-full" /></div>
            ) : (
              <div className="mt-4 space-y-3.5">
                <CompletionRow icon={User} label="Personal profile" value={personalCompletion} count={personal?.fieldCount ?? 0} href="/vault/personal" />
                <CompletionRow icon={Building2} label="Business profile" value={businessCompletion} count={business?.fieldCount ?? 0} href="/vault/business" />
                <div className="flex items-center justify-between text-[13px]">
                  <span className="flex items-center gap-2 text-slate-500">
                    <FileUp className="h-3.5 w-3.5 text-slate-400" /> Documents stored
                  </span>
                  <span className="font-bold text-ink-900">{totalDocs}</span>
                </div>
                <div className="flex items-center justify-between text-[13px]">
                  <span className="flex items-center gap-2 text-slate-500">
                    <FileCheck2 className="h-3.5 w-3.5 text-slate-400" /> Verified fields
                  </span>
                  <span className="font-bold text-ink-900">
                    {(data?.profiles ?? []).reduce((acc, p) => acc + (p.verifiedFieldCount ?? 0), 0)}
                  </span>
                </div>
              </div>
            )}
          </Card>

          {/* Applications */}
          <Card className="p-5">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-[14px] font-bold text-ink-900">Applications</h2>
              <Link href="/applications" className="text-[12px] font-semibold text-electric-600 hover:underline">
                View all
              </Link>
            </div>
            {loading ? (
              <div className="mt-4 space-y-3"><Skeleton className="h-9 w-full" /><Skeleton className="h-9 w-full" /><Skeleton className="h-9 w-full" /></div>
            ) : (
              <div className="mt-4 space-y-3.5">
                <StatRow label="Total applications" value={data?.appStats.total ?? 0} />
                <StatRow label="Submitted" value={data?.appStats.submitted ?? 0} />
                <StatRow label="Pending" value={data?.appStats.pending ?? 0} />
                {data?.apps[0] && (
                  <div className="flex items-center gap-2 rounded-lg bg-mist-50 px-3 py-2 text-[12px] text-slate-600">
                    <Clock3 className="h-3.5 w-3.5 text-slate-400" />
                    <span className="truncate">Latest: {data.apps[0].applicationName}</span>
                  </div>
                )}
              </div>
            )}
          </Card>

          {/* Quick actions */}
          <Card className="p-5 md:col-span-2 xl:col-span-1">
            <h2 className="font-display text-[14px] font-bold text-ink-900">Quick actions</h2>
            <div className="mt-4 grid gap-2">
              <QuickAction icon={Plus} label="Add information" href="/vault/personal" />
              <QuickAction icon={FileUp} label="Upload document" href="/documents" />
              <QuickAction icon={Mic} label="Talk to D" href="/assistant" />
              <QuickAction icon={History} label="View applications" href="/applications" />
              <QuickAction icon={Puzzle} label="Install Chrome extension" href="/extension-setup" />
            </div>
          </Card>
        </div>

        {/* ================= ACTIVITY + SYNC ================= */}
        <div className="mt-4 grid gap-4 lg:grid-cols-3">
          {/* Recent activity */}
          <Card className="p-5 lg:col-span-2">
            <h2 className="font-display text-[14px] font-bold text-ink-900">Recent activity</h2>
            {loading ? (
              <div className="mt-4 space-y-3"><Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-full" /></div>
            ) : (
              <div className="mt-4">
                {(!data || (data.documents.length === 0 && data.apps.length === 0 && data.profiles.length === 0)) ? (
                  <EmptyState
                    icon={<Clock3 className="h-7 w-7" />}
                    title="Nothing yet — and that's honest"
                    description="As you add vault fields, upload documents and save applications, your real activity shows up here. D-Vault doesn't fabricate history."
                  />
                ) : (
                  <ul className="space-y-1">
                    {data.documents[0] && (
                      <ActivityRow icon={FileUp} title={`Document uploaded — ${data.documents[0].filename}`} time={data.documents[0].createdAt} />
                    )}
                    {data.apps[0] && (
                      <ActivityRow icon={History} title={`Application saved — ${data.apps[0].applicationName}`} time={data.apps[0].createdAt} />
                    )}
                    {data.profiles[0] && (
                      <ActivityRow icon={Database} title={`Profile created — ${data.profiles[0].profileName}`} time={null} />
                    )}
                  </ul>
                )}
              </div>
            )}
          </Card>

          {/* Sync status */}
          <Card className="p-5">
            <h2 className="font-display text-[14px] font-bold text-ink-900">Sync status</h2>
            <div className="mt-4 space-y-3">
              <div className="flex items-center justify-between rounded-xl bg-mist-50 px-3.5 py-3">
                <span className="flex items-center gap-2 text-[12.5px] font-medium text-slate-600">
                  <CloudCheck className="h-4 w-4 text-emerald-500" /> Cloud backup
                </span>
                <Badge tone="green">Encrypted</Badge>
              </div>
              <div className="flex items-center justify-between rounded-xl bg-mist-50 px-3.5 py-3">
                <span className="flex items-center gap-2 text-[12.5px] font-medium text-slate-600">
                  <Database className="h-4 w-4 text-bright-500" /> Local cache
                </span>
                <Badge tone={data?.profiles.length ? "blue" : "gray"}>
                  {data?.profiles.length ? "Active" : "Empty"}
                </Badge>
              </div>
              <div className="rounded-xl bg-mist-50 px-3.5 py-3">
                <div className="flex items-center gap-2 text-[12.5px] font-medium text-slate-600">
                  <Hourglass className="h-4 w-4 text-slate-400" /> Last synchronized
                </div>
                <p className="mt-1 text-[12px] text-slate-400">
                  {loading
                    ? "—"
                    : lastSynced
                      ? new Date(lastSynced).toLocaleString()
                      : "Not synced yet"}
                </p>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

function CompletionRow({ icon: Icon, label, value, count, href }: {
  icon: typeof User; label: string; value: number; count: number; href: string;
}) {
  return (
    <Link href={href} className="block rounded-lg px-1.5 py-1 transition hover:bg-mist-50">
      <div className="flex items-center justify-between text-[13px]">
        <span className="flex items-center gap-2 text-slate-600">
          <Icon className="h-3.5 w-3.5 text-slate-400" /> {label}
        </span>
        <span className="font-bold text-ink-900">{value}%</span>
      </div>
      <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-mist-100">
        <div className="h-full rounded-full bg-gradient-to-r from-electric-600 to-ice-300 transition-all duration-700" style={{ width: `${value}%` }} />
      </div>
      <p className="mt-1 text-[11px] text-slate-400">{count} of fields filled</p>
    </Link>
  );
}

function StatRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between text-[13px]">
      <span className="text-slate-500">{label}</span>
      <span className="font-bold text-ink-900">{value}</span>
    </div>
  );
}

function QuickAction({ icon: Icon, label, href }: { icon: typeof Plus; label: string; href: string }) {
  return (
    <Link href={href} className="group flex items-center gap-3 rounded-xl border border-mist-200 bg-white px-3.5 py-2.5 text-[13px] font-medium text-ink-700 transition hover:border-ice-300 hover:text-ink-900 hover:shadow-soft">
      <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-mist-100 transition group-hover:bg-electric-600/10">
        <Icon className="h-3.5 w-3.5 text-electric-600" />
      </span>
      {label}
      <ArrowRight className="ml-auto h-3.5 w-3.5 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-electric-600" />
    </Link>
  );
}

function ActivityRow({ icon: Icon, title, time }: { icon: typeof FileUp; title: string; time: string | null }) {
  return (
    <li className="flex items-center gap-3 rounded-xl px-2 py-2.5 transition hover:bg-mist-50">
      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-electric-600/10">
        <Icon className="h-4 w-4 text-electric-600" />
      </span>
      <span className="flex-1 text-[13px] text-ink-700">{title}</span>
      {time && <span className="text-[11.5px] text-slate-400">{new Date(time).toLocaleDateString()}</span>}
    </li>
  );
}
