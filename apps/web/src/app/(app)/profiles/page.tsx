"use client";

import { useCallback, useEffect, useState } from "react";
import { User, Building2, Plus, Trash2, Pencil, BadgeCheck } from "lucide-react";
import { Button, Card, Badge, EmptyState, Skeleton, Input } from "@/components/ui/primitives";
import { Modal, ConfirmDialog } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";

interface ProfileRow {
  id: string; profileType: string; profileName: string; isDefault: boolean;
  fieldCount: number; documentCount: number; applicationCount: number;
}

export default function ProfilesPage() {
  const { toast } = useToast();
  const [profiles, setProfiles] = useState<ProfileRow[] | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [newType, setNewType] = useState<"personal" | "business">("personal");
  const [newName, setNewName] = useState("");
  const [rename, setRename] = useState<ProfileRow | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [deleteProfile, setDeleteProfile] = useState<ProfileRow | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch("/api/profiles", { credentials: "include" });
    const { profiles } = (await res.json()) as { profiles: ProfileRow[] };
    setProfiles(profiles);
  }, []);
  useEffect(() => { load(); }, [load]);

  async function create() {
    setBusy(true);
    const res = await fetch("/api/profiles", {
      method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include",
      body: JSON.stringify({ profileType: newType, profileName: newName || (newType === "personal" ? "My personal profile" : "My business profile") }),
    });
    setBusy(false);
    if (res.ok) {
      toast("success", "Profile created.");
      setCreateOpen(false); setNewName("");
      load();
    } else {
      const { error } = await res.json();
      toast("error", error ?? "Could not create the profile.");
    }
  }

  async function remove(p: ProfileRow) {
    const res = await fetch(`/api/profiles/${p.id}`, { method: "DELETE", credentials: "include" });
    if (res.ok) {
      toast("success", "Profile deleted.");
      setDeleteProfile(null);
      load();
    } else {
      const { error } = await res.json();
      toast("error", error ?? "Could not delete.");
      setDeleteProfile(null);
    }
  }

  async function doRename() {
    if (!rename || !renameValue.trim()) return;
    const res = await fetch(`/api/profiles/${rename.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, credentials: "include",
      body: JSON.stringify({ profileName: renameValue.trim() }),
    });
    if (res.ok) { toast("success", "Renamed."); setRename(null); load(); }
    else toast("error", "Could not rename.");
  }

  return (
    <div className="mx-auto max-w-4xl px-5 py-8 sm:px-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="display-2 text-[28px] text-ink-900">Profiles</h1>
          <p className="mt-1 text-[13.5px] text-slate-500">
            Keep your personal life and your company separate — D switches between them on command.
          </p>
        </div>
        <Button icon={<Plus className="h-4 w-4" />} onClick={() => setCreateOpen(true)}>New profile</Button>
      </div>

      <div className="mt-6">
        {profiles === null ? (
          <div className="space-y-3"><Skeleton className="h-24 w-full" /><Skeleton className="h-24 w-full" /></div>
        ) : profiles.length === 0 ? (
          <EmptyState
            icon={<User className="h-8 w-8" />}
            title="No profiles yet"
            description="Create a personal profile, a business profile, or several — each gets its own vault and documents."
            action={<Button onClick={() => setCreateOpen(true)}>Create your first profile</Button>}
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {profiles.map((p) => (
              <Card key={p.id} className="group p-5">
                <div className="flex items-start justify-between">
                  <span className={`flex h-11 w-11 items-center justify-center rounded-xl ${p.profileType === "personal" ? "bg-electric-600/10" : "bg-blush-300/15"}`}>
                    {p.profileType === "personal"
                      ? <User className="h-5 w-5 text-electric-600" />
                      : <Building2 className="h-5 w-5 text-blush-400" />}
                  </span>
                  <div className="flex gap-0.5 opacity-0 transition group-hover:opacity-100">
                    <button aria-label="Rename" onClick={() => { setRename(p); setRenameValue(p.profileName); }} className="rounded-lg p-2 text-slate-400 hover:bg-mist-100 hover:text-ink-700">
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button aria-label="Delete" onClick={() => setDeleteProfile(p)} className="rounded-lg p-2 text-red-400 hover:bg-red-50">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
                <h2 className="mt-3 text-[15px] font-bold text-ink-900">{p.profileName}</h2>
                <div className="mt-1 flex items-center gap-2">
                  <Badge tone={p.profileType === "personal" ? "blue" : "pink"}>{p.profileType}</Badge>
                  {p.isDefault && (
                    <Badge tone="gray"><BadgeCheck className="h-3 w-3" /> default</Badge>
                  )}
                </div>
                <div className="mt-4 flex gap-4 text-[12px] text-slate-500">
                  <span><strong className="text-ink-800">{p.fieldCount}</strong> fields</span>
                  <span><strong className="text-ink-800">{p.documentCount}</strong> documents</span>
                  <span><strong className="text-ink-800">{p.applicationCount}</strong> applications</span>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="New profile"
        width="max-w-sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button loading={busy} onClick={create}>Create</Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            {(["personal", "business"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setNewType(t)}
                className={`rounded-xl border p-4 text-left transition ${newType === t ? "border-electric-600 bg-electric-600/5" : "border-mist-200 hover:border-ice-300"}`}
              >
                {t === "personal" ? <User className="h-4.5 w-4.5 text-electric-600" /> : <Building2 className="h-4.5 w-4.5 text-blush-400" />}
                <p className="mt-2 text-[13.5px] font-bold text-ink-900">{t === "personal" ? "Personal" : "Business"}</p>
                <p className="text-[11.5px] text-slate-500">{t === "personal" ? "You and your family" : "Your company / startup"}</p>
              </button>
            ))}
          </div>
          <Input
            label="Profile name"
            placeholder={newType === "personal" ? "e.g. Aarav Mehta (Personal)" : "e.g. NovaStack Technologies"}
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
          />
        </div>
      </Modal>

      <Modal
        open={!!rename}
        onClose={() => setRename(null)}
        title="Rename profile"
        width="max-w-sm"
        footer={<><Button variant="ghost" onClick={() => setRename(null)}>Cancel</Button><Button onClick={doRename}>Rename</Button></>}
      >
        <Input label="Profile name" value={renameValue} onChange={(e) => setRenameValue(e.target.value)} />
      </Modal>

      <ConfirmDialog
        open={!!deleteProfile}
        onClose={() => setDeleteProfile(null)}
        onConfirm={() => deleteProfile && remove(deleteProfile)}
        title={`Delete “${deleteProfile?.profileName}”?`}
        body={`This permanently removes the profile, its ${deleteProfile?.fieldCount ?? 0} encrypted fields and its documents. Default profiles can't be deleted. Applications keep their history but lose the profile link.`}
        confirmLabel="Delete profile"
        danger
      />
    </div>
  );
}
