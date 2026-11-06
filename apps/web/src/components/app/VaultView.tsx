"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Plus, Search, Eye, EyeOff, Pencil, Trash2, BadgeCheck, Mic, X, History,
  ChevronDown, Loader2, CircleAlert, FileText,
} from "lucide-react";
import {
  CATEGORIES, CATEGORY_ORDER, fieldsForProfile, fieldsForCategory, FIELD_MAP,
  type VaultCategory, type ProfileType, type FieldDef,
} from "@dvault/core";
import { Button, Input, Textarea, Card, Badge, EmptyState, Skeleton, Select } from "@/components/ui/primitives";
import { ConfirmDialog } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { useVaultSession, reportSync } from "@/lib/client/vault-session";
import { cachePut } from "@/lib/client/local-cache";
import type { CipherEnvelope } from "@dvault/core";

export interface VaultFieldRow {
  id: string;
  fieldKey: string;
  category: string;
  isSensitive: boolean;
  verified: boolean;
  encryptedValue: CipherEnvelope;
  sourceDocumentId: string | null;
  updatedAt: string;
}

export interface VaultProfile {
  id: string;
  profileType: ProfileType;
  profileName: string;
}

const CATEGORY_ICONS: Record<VaultCategory, string> = {
  personal: "User",
  family: "Users",
  identity: "IdCard",
  contact: "MapPin",
  education: "GraduationCap",
  employment: "Briefcase",
  "business-company": "Building2",
  "business-founder": "UserRound",
  "business-startup": "Rocket",
  "business-grants": "Award",
  "references": "Hash",
};

/** Renders the full vault UI for one profile type (personal or business). */
export function VaultView({ profileType }: { profileType: ProfileType }) {
  const session = useVaultSession();
  const { toast } = useToast();
  const router = useRouter();
  const [profile, setProfile] = useState<VaultProfile | null>(null);
  const [rows, setRows] = useState<VaultFieldRow[] | null>(null);
  const [decrypted, setDecrypted] = useState<Record<string, string>>({});
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<VaultCategory | "all">("all");
  const [openCats, setOpenCats] = useState<Record<string, boolean>>({});
  const [editorField, setEditorField] = useState<FieldDef | null>(null);
  const [editorValue, setEditorValue] = useState("");
  const [editorNew, setEditorNew] = useState(false);
  const [deleteField, setDeleteField] = useState<VaultFieldRow | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!session) return;
    const pRes = await fetch("/api/profiles", { credentials: "include" });
    const { profiles } = (await pRes.json()) as { profiles: (VaultProfile & { profileType: ProfileType })[] };
    const mine = profiles.find((p) => p.profileType === profileType);
    if (!mine) {
      setProfile(null);
      setRows([]);
      return;
    }
    setProfile(mine);
    const fRes = await fetch(`/api/profiles/${mine.id}/fields`, { credentials: "include" });
    const { fields } = (await fRes.json()) as { fields: VaultFieldRow[] };
    setRows(fields);
    // decrypt all values locally
    const dec: Record<string, string> = {};
    for (const f of fields) {
      try {
        dec[f.fieldKey] = await session.decrypt(f.encryptedValue);
      } catch {
        dec[f.fieldKey] = "Unable to decrypt";
      }
    }
    setDecrypted(dec);
    cachePut(`fields:${session.user.id}`, fields).catch(() => undefined);
    // report the real local-cache sync state to the server (Security Center + dashboard)
    reportSync("ok", `${fields.length} encrypted fields cached`).catch(() => undefined);
  }, [session, profileType]);

  useEffect(() => { load(); }, [load]);

  const categories = useMemo(() => {
    const cats = Object.keys(CATEGORIES)
      .filter((c) => CATEGORIES[c as VaultCategory].profileType === profileType)
      .sort((a, b) => CATEGORY_ORDER[a as VaultCategory] - CATEGORY_ORDER[b as VaultCategory]) as VaultCategory[];
    return cats;
  }, [profileType]);

  const visibleCats = useMemo(() => {
    if (!categories) return [];
    let cats = categories;
    if (filter !== "all") cats = cats.filter((c) => c === filter);
    if (search.trim()) {
      const q = search.toLowerCase();
      cats = cats.filter((c) =>
        fieldsForCategory(c).some(
          (f) =>
            f.label.toLowerCase().includes(q) ||
            f.key.toLowerCase().includes(q) ||
            (decrypted[f.key] ?? "").toLowerCase().includes(q),
        ),
      );
    }
    return cats;
  }, [categories, filter, search, decrypted]);

  async function saveField(def: FieldDef, value: string) {
    if (!session || !profile) return;
    setBusy(true);
    try {
      const env = await session.encrypt(value);
      const res = await fetch(`/api/profiles/${profile.id}/fields`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ fieldKey: def.key, encryptedValue: env, verified: false }),
      });
      if (!res.ok) throw new Error();
      toast("success", `${def.label} saved (encrypted on this device).`);
      setEditorField(null);
      await load();
    } catch {
      toast("error", `Could not save ${def.label}.`);
    } finally {
      setBusy(false);
    }
  }

  async function removeField(row: VaultFieldRow) {
    const res = await fetch(`/api/fields/${row.id}`, { method: "DELETE", credentials: "include" });
    if (res.ok) {
      toast("success", `${FIELD_MAP[row.fieldKey]?.label ?? "Field"} removed.`);
      setDeleteField(null);
      await load();
    } else {
      toast("error", "Could not remove the field.");
    }
  }

  async function toggleVerify(row: VaultFieldRow) {
    const res = await fetch(`/api/fields/${row.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ verified: !row.verified }),
    });
    if (res.ok) {
      await load();
    } else {
      toast("error", "Could not update verification.");
    }
  }

  if (!rows) {
    return (
      <div className="mx-auto max-w-6xl space-y-4 px-5 py-10 sm:px-8">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="mx-auto max-w-6xl px-5 py-16 sm:px-8">
        <EmptyState
          icon={<CircleAlert className="h-8 w-8" />}
          title={`No ${profileType} profile yet`}
          description="Create one from the Profiles page and this vault unlocks — every category below, ready to fill."
          action={<Button onClick={() => router.push("/profiles")}>Create a profile</Button>}
        />
      </div>
    );
  }

  const filledCount = rows.length;
  const totalFields = fieldsForProfile(profileType).length;

  return (
    <div className="mx-auto max-w-6xl px-5 py-8 sm:px-8">
      {/* header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="display-2 text-[28px] text-ink-900">
            {profileType === "personal" ? "Personal vault" : "Business vault"}
          </h1>
          <p className="mt-1 text-[13.5px] text-slate-500">
            {profile.profileName} · {filledCount}/{totalFields} fields · encrypted on this device
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="secondary" icon={<Mic className="h-4 w-4" />} onClick={() => router.push("/assistant")}>
            Tell D what to remember
          </Button>
          <Button
            icon={<Plus className="h-4 w-4" />}
            onClick={() => {
              const firstEmpty = fieldsForProfile(profileType).find(
                (f) => !rows.some((r) => r.fieldKey === f.key),
              );
              if (firstEmpty) {
                setEditorField(firstEmpty);
                setEditorValue("");
                setEditorNew(true);
              } else {
                toast("info", "Every field already has a value. Edit any field to update it.");
              }
            }}
          >
            Add information
          </Button>
        </div>
      </div>

      {/* search + filter */}
      <div className="mt-6 flex flex-wrap items-center gap-3">
        <div className="relative min-w-[240px] flex-1">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            aria-label="Search vault fields"
            placeholder="Search fields or values…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-10 w-full rounded-xl border border-mist-200 bg-white pl-10 pr-4 text-[14px] transition focus:outline-none focus:ring-2 focus:ring-bright-500/40"
          />
          {search && (
            <button aria-label="Clear search" onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-ink-700">
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        <div className="flex gap-1.5 overflow-x-auto pb-1">
          <FilterChip active={filter === "all"} onClick={() => setFilter("all")}>All</FilterChip>
          {categories.map((c) => (
            <FilterChip key={c} active={filter === c} onClick={() => setFilter(c)}>
              {CATEGORIES[c].label.split(" ")[0]}
            </FilterChip>
          ))}
        </div>
      </div>

      {/* category sections */}
      <div className="mt-6 space-y-4">
        {visibleCats.map((cat) => {
          const defs = fieldsForCategory(cat);
          const meta = CATEGORIES[cat];
          const catRows = defs.map((def) => ({
            def,
            row: rows.find((r) => r.fieldKey === def.key) ?? null,
          }));
          const open = openCats[cat] ?? (search.trim().length > 0 ? true : catRows.some((r) => r.row));
          const filledHere = catRows.filter((r) => r.row).length;
          return (
            <Card key={cat}>
              <button
                onClick={() => setOpenCats((o) => ({ ...o, [cat]: !open }))}
                className="flex w-full items-center justify-between px-5 py-4 text-left"
                aria-expanded={open}
              >
                <div>
                  <h2 className="font-display text-[15px] font-bold text-ink-900">{meta.label}</h2>
                  <p className="mt-0.5 text-[12px] text-slate-500">{meta.description}</p>
                </div>
                <div className="flex items-center gap-3">
                  <Badge tone={filledHere ? "blue" : "gray"}>{filledHere}/{defs.length}</Badge>
                  <ChevronDown className={`h-4 w-4 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`} />
                </div>
              </button>
              {open && (
                <div className="border-t border-mist-200">
                  {catRows.map(({ def, row }) => (
                    <FieldRow
                      key={def.key}
                      def={def}
                      value={row ? decrypted[def.key] ?? "" : null}
                      verified={row?.verified ?? false}
                      hasSource={!!row?.sourceDocumentId}
                      updatedAt={row?.updatedAt}
                      onEdit={() => {
                        setEditorField(def);
                        setEditorValue(row ? decrypted[def.key] ?? "" : "");
                        setEditorNew(!row);
                      }}
                      onDelete={row ? () => setDeleteField(row) : undefined}
                      onVerify={row ? () => toggleVerify(row) : undefined}
                    />
                  ))}
                </div>
              )}
            </Card>
          );
        })}
        {visibleCats.length === 0 && (
          <EmptyState
            icon={<Search className="h-7 w-7" />}
            title="No fields match"
            description="Try a different search or category filter."
          />
        )}
      </div>

      {/* editor modal */}
      {editorField && (
        <EditorModal
          def={editorField}
          initial={editorValue}
          isNew={editorNew}
          busy={busy}
          onClose={() => setEditorField(null)}
          onSave={(v) => saveField(editorField, v)}
        />
      )}

      <ConfirmDialog
        open={!!deleteField}
        onClose={() => setDeleteField(null)}
        onConfirm={() => deleteField && removeField(deleteField)}
        title="Remove this field?"
        body={`"${FIELD_MAP[deleteField?.fieldKey ?? ""]?.label ?? "This field"}" will be deleted from your vault. The value is encrypted — this cannot be undone.`}
        confirmLabel="Remove"
        danger
      />
    </div>
  );
}

function FilterChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`h-8 shrink-0 rounded-full border px-3.5 text-[12.5px] font-semibold transition ${
        active
          ? "border-electric-600 bg-electric-600 text-white"
          : "border-mist-200 bg-white text-slate-500 hover:border-ice-300 hover:text-ink-700"
      }`}
    >
      {children}
    </button>
  );
}

function FieldRow({
  def, value, verified, hasSource, updatedAt, onEdit, onDelete, onVerify,
}: {
  def: FieldDef;
  value: string | null;
  verified: boolean;
  hasSource: boolean;
  updatedAt?: string;
  onEdit: () => void;
  onDelete?: () => void;
  onVerify?: () => void;
}) {
  const [revealed, setRevealed] = useState(false);
  const masked = def.sensitive && !revealed;

  return (
    <div className="group flex items-center gap-3 border-b border-mist-100 px-5 py-3 last:border-0 hover:bg-mist-50/60">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="text-[13.5px] font-medium text-ink-800">{def.label}</p>
          {verified && (
            <span title="Verified by you">
              <BadgeCheck className="h-3.5 w-3.5 text-emerald-500" />
            </span>
          )}
          {hasSource && (
            <span title="Extracted from a document you uploaded">
              <FileText className="h-3.5 w-3.5 text-slate-400" />
            </span>
          )}
          {def.sensitive && <Badge tone="pink">Sensitive</Badge>}
        </div>
        {value === null ? (
          <p className="mt-0.5 text-[12.5px] italic text-slate-400">Not filled yet</p>
        ) : (
          <p className={`mt-0.5 truncate text-[13px] ${masked ? "font-mono tracking-wider text-slate-500" : "text-slate-600"}`}>
            {masked
              ? "•••• •••• ••••" + value.slice(-2)
              : def.inputType === "textarea"
                ? value.slice(0, 80) + (value.length > 80 ? "…" : "")
                : value}
          </p>
        )}
        {updatedAt && (
          <p className="mt-0.5 text-[10.5px] text-slate-400">
            Updated {new Date(updatedAt).toLocaleDateString()}
          </p>
        )}
      </div>
      <div className="flex items-center gap-0.5 opacity-0 transition group-hover:opacity-100 focus-within:opacity-100">
        {def.sensitive && value !== null && (
          <IconBtn label={revealed ? "Hide value" : "Reveal value"} onClick={() => setRevealed(!revealed)}>
            {revealed ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
          </IconBtn>
        )}
        {value !== null && onVerify && (
          <IconBtn label={verified ? "Remove verification" : "Mark as verified"} onClick={onVerify}>
            <BadgeCheck className={`h-3.5 w-3.5 ${verified ? "text-emerald-500" : "text-slate-400"}`} />
          </IconBtn>
        )}
        <IconBtn label="Edit" onClick={onEdit}>
          <Pencil className="h-3.5 w-3.5" />
        </IconBtn>
        {onDelete && (
          <IconBtn label="Remove" onClick={onDelete}>
            <Trash2 className="h-3.5 w-3.5 text-red-400" />
          </IconBtn>
        )}
      </div>
    </div>
  );
}

function IconBtn({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      title={label}
      className="rounded-lg p-2 text-slate-400 transition hover:bg-mist-100 hover:text-ink-700"
    >
      {children}
    </button>
  );
}

function EditorModal({ def, initial, isNew, busy, onClose, onSave }: {
  def: FieldDef;
  initial: string;
  isNew: boolean;
  busy: boolean;
  onClose: () => void;
  onSave: (value: string) => void;
}) {
  const [value, setValue] = useState(initial);
  return (
    <div className="fixed inset-0 z-[90] flex items-end justify-center p-4 sm:items-center" role="dialog" aria-modal="true" aria-label={`Edit ${def.label}`}>
      <button aria-label="Close" className="absolute inset-0 bg-ink-950/55" onClick={onClose} />
      <div className="relative z-10 w-full max-w-md rounded-2xl border border-mist-200 bg-white p-6 shadow-lift rise-in">
        <h2 className="font-display text-[16px] font-bold text-ink-900">
          {isNew ? "Add" : "Update"} — {def.label}
        </h2>
        <p className="mt-1 text-[12.5px] text-slate-500">
          Encrypted on this device before it's sent to your vault.
        </p>
        <form
          onSubmit={(e) => { e.preventDefault(); onSave(value); }}
          className="mt-5 space-y-4"
        >
          {def.inputType === "textarea" ? (
            <Textarea
              label={def.label}
              rows={3}
              autoFocus
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder={def.placeholder ?? def.help}
            />
          ) : def.inputType === "select" ? (
            <Input
              label={def.label}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder={def.help ?? "e.g. Private Limited"}
            />
          ) : (
            <Input
              label={def.label}
              type={def.inputType === "date" ? "date" : def.inputType === "number" ? "number" : def.inputType === "email" ? "email" : def.inputType === "tel" ? "tel" : "text"}
              autoFocus
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder={def.placeholder ?? def.help}
              hint={def.sensitive ? "Sensitive — masked by default everywhere in D-Vault." : undefined}
            />
          )}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={!value.trim()} loading={busy}>
              {busy ? "Encrypting…" : "Save"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
