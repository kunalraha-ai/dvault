"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft, ExternalLink, Copy, Eye, EyeOff, Download, FileImage, FileDown,
  BadgeCheck, History, Globe, CalendarClock, StickyNote,
} from "lucide-react";
import { Button, Card, Badge, Skeleton, EmptyState, Select, Textarea } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";
import { useVaultSession } from "@/lib/client/vault-session";
import { APPLICATION_STATUSES } from "@/lib/core";

interface Detail {
  applicationName: string; websiteDomain: string; applicationUrl: string;
  encryptedReferenceId: { c: string; iv: string } | null;
  encryptedNotes: { c: string; iv: string } | null;
  submissionDate: string | null; status: string; isDemo: boolean;
  profileName: string | null; createdAt: string; updatedAt: string;
  attachments: { id: string; attachmentType: string; filename: string; fileSize: number; createdAt: string }[];
  statusHistory: { id: string; status: string; note: string | null; changedAt: string }[];
}

export default function ApplicationDetailPage() {
  const { id } = useParams<{ id: string }>();
  const session = useVaultSession();
  const { toast } = useToast();
  const router = useRouter();
  const [app, setApp] = useState<Detail | null>(null);
  const [ref, setRef] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [reveal, setReveal] = useState(false);
  const [savingNotes, setSavingNotes] = useState(false);

  const load = useCallback(async () => {
    if (!session) return;
    const res = await fetch(`/api/applications/${id}`, { credentials: "include" });
    if (!res.ok) { setApp(null); return; }
    const { application } = (await res.json()) as { application: Detail };
    setApp(application);
    if (application.encryptedReferenceId) {
      setRef(await session.decrypt(application.encryptedReferenceId).catch(() => null));
    }
    if (application.encryptedNotes) {
      setNotes(await session.decrypt(application.encryptedNotes).catch(() => ""));
    }
  }, [id, session]);

  useEffect(() => { load(); }, [load]);

  async function setStatus(status: string) {
    const res = await fetch(`/api/applications/${id}/status`, {
      method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include",
      body: JSON.stringify({ status, note: "Updated from detail view" }),
    });
    if (res.ok) { toast("success", `Status set to “${status}”.`); load(); }
    else toast("error", "Could not update status.");
  }

  async function saveNotes() {
    if (!session) return;
    setSavingNotes(true);
    const enc = await session.encrypt(notes);
    const res = await fetch(`/api/applications/${id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, credentials: "include",
      body: JSON.stringify({ encryptedNotes: notes ? enc : null }),
    });
    setSavingNotes(false);
    if (res.ok) toast("success", "Notes saved (encrypted).");
    else toast("error", "Could not save notes.");
  }

  if (!app && session) {
    return (
      <div className="mx-auto max-w-4xl px-5 py-16 sm:px-8">
        {app === null && <div className="space-y-4"><Skeleton className="h-10 w-2/3" /><Skeleton className="h-40 w-full" /><Skeleton className="h-40 w-full" /></div>}
      </div>
    );
  }
  if (!app) return null;

  return (
    <div className="mx-auto max-w-4xl px-5 py-8 sm:px-8">
      <button onClick={() => router.back()} className="mb-5 inline-flex items-center gap-2 text-[13px] font-semibold text-slate-500 transition hover:text-ink-900">
        <ArrowLeft className="h-4 w-4" /> Back
      </button>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="display-2 text-[26px] text-ink-900">{app.applicationName}</h1>
            <Badge tone={app.status === "approved" ? "green" : app.status === "rejected" ? "red" : app.status === "pending" ? "amber" : app.status === "submitted" ? "blue" : "gray"}>
              {app.status}
            </Badge>
            {app.isDemo && <Badge tone="pink">Fictional</Badge>}
          </div>
          <p className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12.5px] text-slate-500">
            <span className="flex items-center gap-1.5"><Globe className="h-3.5 w-3.5" />{app.websiteDomain}</span>
            {app.submissionDate && (
              <span className="flex items-center gap-1.5"><CalendarClock className="h-3.5 w-3.5" />Submitted {new Date(app.submissionDate).toLocaleDateString()}</span>
            )}
            {app.profileName && <span className="flex items-center gap-1.5"><BadgeCheck className="h-3.5 w-3.5" />{app.profileName}</span>}
          </p>
        </div>
        <a href={app.applicationUrl} target="_blank" rel="noopener noreferrer">
          <Button variant="secondary" icon={<ExternalLink className="h-4 w-4" />}>Open original</Button>
        </a>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        {/* reference + status */}
        <Card className="p-5 lg:col-span-1">
          <h2 className="font-display text-[14px] font-bold text-ink-900">Reference / acknowledgement ID</h2>
          {ref ? (
            <div className="mt-3">
              <code className="block break-all rounded-xl bg-mist-100 px-3.5 py-3 text-[13px] font-semibold text-ink-900">
                {reveal ? ref : "•••• •••• ••••" + ref.slice(-3)}
              </code>
              <div className="mt-2 flex gap-2">
                <button onClick={() => setReveal(!reveal)} className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-electric-600 hover:underline">
                  {reveal ? <><EyeOff className="h-3.5 w-3.5" /> Hide</> : <><Eye className="h-3.5 w-3.5" /> Reveal</>}
                </button>
                <button onClick={() => { navigator.clipboard.writeText(ref); toast("success", "Copied."); }} className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-electric-600 hover:underline">
                  <Copy className="h-3.5 w-3.5" /> Copy
                </button>
              </div>
            </div>
          ) : (
            <p className="mt-3 text-[13px] italic text-slate-400">No reference ID was saved for this application.</p>
          )}

          <h2 className="mt-6 font-display text-[14px] font-bold text-ink-900">Update status</h2>
          <p className="mt-1 text-[11.5px] text-slate-500">
            D-Vault never guesses statuses — you set them.
          </p>
          <Select value={app.status} onChange={(e) => setStatus(e.target.value)} className="mt-2">
            {APPLICATION_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          </Select>
        </Card>

        {/* evidence */}
        <Card className="p-5 lg:col-span-1">
          <h2 className="font-display text-[14px] font-bold text-ink-900">Evidence & attachments</h2>
          {app.attachments.length === 0 ? (
            <p className="mt-3 text-[13px] italic text-slate-400">
              No screenshot or receipt saved. Capture them from the extension by saying “save this application” on the confirmation page.
            </p>
          ) : (
            <ul className="mt-3 space-y-2">
              {app.attachments.map((att) => (
                <li key={att.id} className="flex items-center gap-3 rounded-xl border border-mist-200 px-3.5 py-2.5">
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-mist-100">
                    {att.attachmentType === "screenshot" ? <FileImage className="h-4 w-4 text-electric-600" /> : <FileDown className="h-4 w-4 text-electric-600" />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[12.5px] font-semibold text-ink-800">{att.attachmentType}</p>
                    <p className="text-[10.5px] text-slate-400">{(att.fileSize / 1024).toFixed(0)} KB · encrypted</p>
                  </div>
                  <a
                    href={`/api/applications/${id}/attachments?blob=1&id=${att.id}`}
                    download={att.filename}
                    className="rounded-lg p-2 text-slate-400 hover:bg-mist-100 hover:text-ink-700"
                    aria-label={`Download ${att.attachmentType}`}
                  >
                    <Download className="h-3.5 w-3.5" />
                  </a>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-4 text-[11px] leading-relaxed text-slate-400">
            Attachments are encrypted on your device with your vault key; the server can't read them.
          </p>
        </Card>

        {/* status history */}
        <Card className="p-5 lg:col-span-1">
          <h2 className="font-display text-[14px] font-bold text-ink-900">Status history</h2>
          {app.statusHistory.length === 0 ? (
            <p className="mt-3 text-[13px] italic text-slate-400">No changes yet.</p>
          ) : (
            <ol className="mt-3 space-y-3">
              {app.statusHistory.map((h) => (
                <li key={h.id} className="flex gap-3">
                  <span className="relative mt-1 flex h-2.5 w-2.5 shrink-0 rounded-full bg-electric-600">
                    <span className="absolute inset-0 rounded-full bg-electric-600/30" style={{ transform: "scale(2)" }} aria-hidden />
                  </span>
                  <div>
                    <p className="text-[12.5px] font-semibold text-ink-800">{h.status}</p>
                    <p className="text-[11px] text-slate-400">{new Date(h.changedAt).toLocaleString()}{h.note ? ` · ${h.note}` : ""}</p>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </Card>
      </div>

      {/* notes */}
      <Card className="mt-4 p-5">
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 font-display text-[14px] font-bold text-ink-900">
            <StickyNote className="h-4 w-4 text-slate-400" /> Notes
          </h2>
          <Button size="sm" variant="secondary" loading={savingNotes} onClick={saveNotes}>Save notes</Button>
        </div>
        <Textarea
          rows={3}
          className="mt-3"
          placeholder="Anything worth remembering about this application (encrypted with your vault key)…"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </Card>
    </div>
  );
}
