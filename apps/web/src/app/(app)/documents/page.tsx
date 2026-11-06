"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  UploadCloud, FileText, Trash2, Pencil, ScanText, CircleAlert, Check, X,
  AlertTriangle, Download, Loader2, FileCheck2, Lock,
} from "lucide-react";
import { Button, Card, Badge, EmptyState, Skeleton, Input, Select, Textarea } from "@/components/ui/primitives";
import { Modal, ConfirmDialog } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { useVaultSession } from "@/lib/client/vault-session";
import { extractFromDocument, type ExtractedCandidate } from "@/lib/client/ocr";
import { FIELD_MAP, DOCUMENT_CATEGORIES, type DocumentCategory } from "@dvault/core";

interface DocRow {
  id: string; profileId: string; profileName: string; profileType: string;
  filename: string; fileType: string; fileSize: number; category: string;
  extractionStatus: string; createdAt: string; hasExtraction: boolean;
}
interface ProfileRow { id: string; profileType: string; profileName: string }
interface ReviewCandidate extends ExtractedCandidate { approved: boolean; edited: boolean }

export default function DocumentsPage() {
  const session = useVaultSession();
  const { toast } = useToast();
  const [docs, setDocs] = useState<DocRow[] | null>(null);
  const [profiles, setProfiles] = useState<ProfileRow[]>([]);
  const [uploadProfile, setUploadProfile] = useState<string>("");
  const [uploadCategory, setUploadCategory] = useState<DocumentCategory>("identity");
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState<{ name: string; phase: string } | null>(null);
  const [review, setReview] = useState<{
    docId: string; filename: string; text: string; note?: string;
    candidates: ReviewCandidate[]; conflicts: Record<string, string>;
  } | null>(null);
  const [deleteDoc, setDeleteDoc] = useState<DocRow | null>(null);
  const [renameDoc, setRenameDoc] = useState<DocRow | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    const [dRes, pRes] = await Promise.all([
      fetch("/api/documents", { credentials: "include" }),
      fetch("/api/profiles", { credentials: "include" }),
    ]);
    const { documents } = await dRes.json();
    const { profiles } = await pRes.json();
    setDocs(documents);
    setProfiles(profiles);
    setUploadProfile((p) => p || profiles[0]?.id || "");
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleFile(file: File) {
    if (!session || !uploadProfile) {
      toast("error", "Pick a profile first (or create one).");
      return;
    }
    setUploading({ name: file.name, phase: "Encrypting on this device…" });
    try {
      // 1. encrypt bytes locally
      const bytes = new Uint8Array(await file.arrayBuffer());
      const env = await session.encryptBlob(bytes);
      const blob = new Blob([env.c], { type: "application/octet-stream" });
      const blobIv = env.iv;

      setUploading({ name: file.name, phase: "Uploading encrypted file…" });
      const form = new FormData();
      form.append("file", blob, `${file.name}.enc`);
      form.append("filename", file.name);
      form.append("profileId", uploadProfile);
      form.append("category", uploadCategory);
      const res = await fetch("/api/documents", { method: "POST", credentials: "include", body: form });
      const data = (await res.json()) as { document?: { id: string }; error?: string };
      if (!res.ok || !data.document) throw new Error(data.error ?? "Upload failed");

      // 2. run on-device OCR/extraction on the PLAINTEXT file (never uploaded)
      setUploading({ name: file.name, phase: "Extracting text on this device…" });
      const extraction = await extractFromDocument(file);

      // 3. persist the extraction (encrypted)
      const encText = await session.encrypt(extraction.text || "(no text)");
      const encFields = await session.encrypt(JSON.stringify(extraction.candidates));
      await fetch(`/api/documents/${data.document.id}/extraction`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          encryptedText: encText,
          encryptedFields: encFields,
          status: extraction.candidates.length ? "extracted" : "skipped",
        }),
      });

      await load();

      // 4. open review if we found anything (or surface the note honestly)
      if (extraction.candidates.length > 0 || extraction.note) {
        const conflicts: Record<string, string> = {};
        if (extraction.candidates.length) {
          const fRes = await fetch(`/api/profiles/${uploadProfile}/fields`, { credentials: "include" });
          const { fields } = (await fRes.json()) as { fields: { fieldKey: string; encryptedValue: { c: string; iv: string } }[] };
          for (const f of fields) {
            try {
              const existing = await session.decrypt(f.encryptedValue);
              const match = extraction.candidates.find((c) => c.fieldKey === f.fieldKey);
              if (match && match.value.trim() !== existing.trim()) {
                conflicts[f.fieldKey] = existing;
              }
            } catch { /* skip */ }
          }
        }
        setReview({
          docId: data.document.id,
          filename: file.name,
          text: extraction.text,
          note: extraction.note,
          candidates: extraction.candidates.map((c) => ({ ...c, approved: true, edited: false })),
          conflicts,
        });
      } else {
        toast("success", `${file.name} stored encrypted. No recognizable fields were found — you can add details manually.`);
      }
    } catch (e) {
      toast("error", e instanceof Error ? e.message : "Upload failed.");
    } finally {
      setUploading(null);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function applyExtraction() {
    if (!review || !session || !uploadProfile) return;
    const approved = review.candidates.filter((c) => c.approved);
    let saved = 0;
    for (const c of approved) {
      const def = FIELD_MAP[c.fieldKey];
      if (!def) continue;
      const env = await session.encrypt(c.value);
      const res = await fetch(`/api/profiles/${uploadProfile}/fields`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          fieldKey: c.fieldKey,
          encryptedValue: env,
          verified: false,
          sourceDocumentId: review.docId,
        }),
      });
      if (res.ok) saved++;
    }
    toast("success", `Saved ${saved} extracted field${saved === 1 ? "" : "s"} to the vault (marked unverified, source: ${review.filename}).`);
    setReview(null);
    await load();
  }

  async function deleteDocument(doc: DocRow) {
    const res = await fetch(`/api/documents/${doc.id}`, { method: "DELETE", credentials: "include" });
    if (res.ok) {
      toast("success", `${doc.filename} deleted (with its encrypted blob).`);
      setDeleteDoc(null);
      load();
    } else toast("error", "Could not delete the document.");
  }

  async function saveRename() {
    if (!renameDoc || !renameValue.trim()) return;
    const res = await fetch(`/api/documents/${renameDoc.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ filename: renameValue.trim() }),
    });
    if (res.ok) {
      toast("success", "Renamed.");
      setRenameDoc(null);
      load();
    } else toast("error", "Could not rename.");
  }

  return (
    <div className="mx-auto max-w-6xl px-5 py-8 sm:px-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="display-2 text-[28px] text-ink-900">Documents</h1>
          <p className="mt-1 text-[13.5px] text-slate-500">
            Encrypted before upload. Text extraction runs on your device — you review before anything is saved.
          </p>
        </div>
      </div>

      {/* uploader */}
      <Card className="mt-6 p-0">
        <div className="grid gap-4 border-b border-mist-200 p-5 sm:grid-cols-2">
          <Select
            label="Attach to profile"
            value={uploadProfile}
            onChange={(e) => setUploadProfile(e.target.value)}
          >
            {profiles.map((p) => (
              <option key={p.id} value={p.id}>{p.profileName}</option>
            ))}
          </Select>
          <Select
            label="Category"
            value={uploadCategory}
            onChange={(e) => setUploadCategory(e.target.value as DocumentCategory)}
          >
            {DOCUMENT_CATEGORIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </Select>
        </div>
        <div
          role="button"
          tabIndex={0}
          aria-label="Upload a document"
          onClick={() => inputRef.current?.click()}
          onKeyDown={(e) => e.key === "Enter" && inputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            const f = e.dataTransfer.files?.[0];
            if (f) handleFile(f);
          }}
          className={`flex cursor-pointer flex-col items-center justify-center gap-3 border-2 border-dashed px-6 py-12 text-center transition ${
            dragOver ? "border-bright-500 bg-electric-600/5" : "border-mist-300 hover:border-ice-300"
          }`}
        >
          {uploading ? (
            <>
              <Loader2 className="h-7 w-7 animate-spin text-electric-600" />
              <p className="text-[14px] font-semibold text-ink-900">{uploading.name}</p>
              <p className="text-[12.5px] text-slate-500">{uploading.phase}</p>
            </>
          ) : (
            <>
              <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-electric-600/10">
                <UploadCloud className="h-6 w-6 text-electric-600" />
              </span>
              <p className="text-[14px] font-semibold text-ink-900">Drag a document here, or click to browse</p>
              <p className="text-[12px] text-slate-500">
                PDF, PNG, JPG, DOC/DOCX (15 MB max) · encrypted with your vault key before leaving this browser
              </p>
            </>
          )}
          <input ref={inputRef} type="file" className="hidden" accept=".pdf,.png,.jpg,.jpeg,.webp,.doc,.docx,.txt,.md" aria-hidden />
        </div>
      </Card>

      {/* list */}
      <div className="mt-6">
        {docs === null ? (
          <div className="space-y-3"><Skeleton className="h-16 w-full" /><Skeleton className="h-16 w-full" /><Skeleton className="h-16 w-full" /></div>
        ) : docs.length === 0 ? (
          <EmptyState
            icon={<FileText className="h-8 w-8" />}
            title="No documents yet"
            description="Aadhaar, PAN, marksheets, incorporation certificates — upload them once and D can reference them in every application."
          />
        ) : (
          <Card className="divide-y divide-mist-100 p-0">
            {docs.map((d) => (
              <div key={d.id} className="group flex items-center gap-4 px-5 py-3.5 transition hover:bg-mist-50/60">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-mist-100 font-display text-[10px] font-extrabold uppercase text-electric-600">
                  {d.fileType.slice(0, 4)}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-[13.5px] font-semibold text-ink-900">{d.filename}</p>
                    <Badge tone="gray">{d.category}</Badge>
                    {d.extractionStatus === "extracted" && (
                      <Badge tone="green"><ScanText className="h-3 w-3" /> extracted</Badge>
                    )}
                    {d.extractionStatus === "pending" && <Badge tone="amber">pending</Badge>}
                    {d.extractionStatus === "failed" && <Badge tone="red">failed</Badge>}
                    {d.extractionStatus === "skipped" && <Badge tone="gray">skipped</Badge>}
                  </div>
                  <p className="mt-0.5 text-[11.5px] text-slate-400">
                    {d.profileName} · {(d.fileSize / 1024).toFixed(0)} KB (encrypted) · uploaded {new Date(d.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex items-center gap-0.5 opacity-0 transition group-hover:opacity-100">
                  <button aria-label="Rename" title="Rename" onClick={() => { setRenameDoc(d); setRenameValue(d.filename); }} className="rounded-lg p-2 text-slate-400 hover:bg-mist-100 hover:text-ink-700">
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button aria-label="Delete" title="Delete" onClick={() => setDeleteDoc(d)} className="rounded-lg p-2 text-red-400 hover:bg-red-50">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </Card>
        )}
      </div>

      <p className="mt-5 flex items-center gap-2 text-[12px] text-slate-400">
        <Lock className="h-3.5 w-3.5" />
        Files are AES-GCM encrypted on this device; the server stores opaque ciphertext under random keys with no public URLs.
      </p>

      {/* extraction review modal */}
      <Modal
        open={!!review}
        onClose={() => setReview(null)}
        title={`Extracted information — ${review?.filename ?? ""}`}
        width="max-w-2xl"
        footer={
          <>
            <Button variant="ghost" onClick={() => setReview(null)}>Review later</Button>
            <Button onClick={applyExtraction} icon={<Check className="h-4 w-4" />}>
              Save approved fields
            </Button>
          </>
        }
      >
        {review && (
          <div className="space-y-4">
            <p className="rounded-xl bg-mist-50 px-4 py-3 text-[12.5px] leading-relaxed text-slate-600">
              Extraction ran <strong>on your device</strong> ({review.note ? "partial" : "OCR complete"}).
              Approve the fields you want stored — they'll be marked <em>unverified</em> with this
              document as their source. Existing values are never silently overwritten.
            </p>
            {review.note && (
              <p className="flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-[12.5px] leading-relaxed text-amber-800">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                {review.note}
              </p>
            )}
            {review.candidates.length === 0 && (
              <p className="text-[13px] text-slate-500">No recognizable fields were found in this document.</p>
            )}
            <div className="divide-y divide-mist-100 rounded-xl border border-mist-200">
              {review.candidates.map((c, i) => (
                <div key={c.fieldKey} className="flex items-center gap-3 px-4 py-3">
                  <button
                    aria-label={c.approved ? `Exclude ${c.fieldKey}` : `Approve ${c.fieldKey}`}
                    onClick={() => setReview((r) => {
                      if (!r) return r;
                      const next = [...r.candidates];
                      next[i] = { ...next[i], approved: !next[i].approved };
                      return { ...r, candidates: next };
                    })}
                    className={`flex h-5.5 w-5.5 shrink-0 items-center justify-center rounded-md border transition ${
                      c.approved ? "border-electric-600 bg-electric-600 text-white" : "border-mist-300 bg-white text-transparent hover:border-bright-500"
                    }`}
                  >
                    <Check className="h-3.5 w-3.5" />
                  </button>
                  <div className="min-w-0 flex-1">
                    <p className="text-[12.5px] font-semibold text-ink-800">
                      {FIELD_MAP[c.fieldKey]?.label ?? c.fieldKey}
                      <span className="ml-2 rounded bg-electric-600/10 px-1.5 py-0.5 text-[10px] font-bold text-electric-600">
                        {Math.round(c.confidence * 100)}%
                      </span>
                    </p>
                    <input
                      aria-label={`Value for ${c.fieldKey}`}
                      value={c.value}
                      onChange={(e) => setReview((r) => {
                        if (!r) return r;
                        const next = [...r.candidates];
                        next[i] = { ...next[i], value: e.target.value, edited: true };
                        return { ...r, candidates: next };
                      })}
                      className="mt-1 h-8 w-full rounded-lg border border-mist-200 bg-white px-3 text-[13px] focus:outline-none focus:ring-2 focus:ring-bright-500/40"
                    />
                    <p className="mt-1 text-[10.5px] text-slate-400">Detected via {c.evidence}</p>
                  </div>
                  {review.conflicts[c.fieldKey] && (
                    <p className="w-32 shrink-0 rounded-lg border border-red-200 bg-red-50 px-2.5 py-2 text-[10.5px] leading-snug text-red-600">
                      Differs from your vault: “{review.conflicts[c.fieldKey].slice(0, 40)}” — keeping this will replace it.
                    </p>
                  )}
                </div>
              ))}
            </div>
            {review.text && (
              <details className="rounded-xl border border-mist-200">
                <summary className="cursor-pointer px-4 py-3 text-[12.5px] font-semibold text-slate-600">
                  View raw extracted text (never leaves this device unencrypted)
                </summary>
                <pre className="max-h-48 overflow-auto whitespace-pre-wrap px-4 pb-4 text-[11px] leading-relaxed text-slate-500">{review.text}</pre>
              </details>
            )}
          </div>
        )}
      </Modal>

      <Modal
        open={!!renameDoc}
        onClose={() => setRenameDoc(null)}
        title="Rename document"
        width="max-w-sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setRenameDoc(null)}>Cancel</Button>
            <Button onClick={saveRename}>Rename</Button>
          </>
        }
      >
        <Input label="Filename" value={renameValue} onChange={(e) => setRenameValue(e.target.value)} />
      </Modal>

      <ConfirmDialog
        open={!!deleteDoc}
        onClose={() => setDeleteDoc(null)}
        onConfirm={() => deleteDoc && deleteDocument(deleteDoc)}
        title="Delete this document?"
        body={`"${deleteDoc?.filename}" and its encrypted blob will be permanently removed. Fields that referenced it stay in your vault (their source link is cleared).`}
        confirmLabel="Delete"
        danger
      />
    </div>
  );
}
