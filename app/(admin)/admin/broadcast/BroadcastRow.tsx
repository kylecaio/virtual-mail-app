"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { logAudit } from "@/lib/audit";

type B = { id: string; title: string; body: string; audience: string; is_active: boolean; created_at: string };
const AUD_LABEL: Record<string, string> = { all: "All customers", active: "Active", past_due: "Past due" };

export default function BroadcastRow({ b }: { b: B }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [confirm, setConfirm] = useState(false);

  async function toggle() {
    setBusy(true); setErr(null);
    const supabase = createClient();
    const next = !b.is_active;
    const { error } = await supabase.from("broadcasts").update({ is_active: next }).eq("id", b.id);
    if (error) { setBusy(false); setErr(error.message); return; }
    await logAudit(supabase, { action: "broadcast.update", entity: "broadcasts", entity_id: b.id, detail: { title: b.title, is_active: next } });
    setBusy(false); router.refresh();
  }

  async function remove() {
    setBusy(true); setErr(null);
    const supabase = createClient();
    const { error } = await supabase.from("broadcasts").delete().eq("id", b.id);
    if (error) { setBusy(false); setErr(error.message); return; }
    await logAudit(supabase, { action: "broadcast.update", entity: "broadcasts", entity_id: b.id, detail: { title: b.title, deleted: true } });
    setBusy(false); router.refresh();
  }

  return (
    <div className="rounded-theme border border-border bg-surface p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-medium text-ink">{b.title}</span>
            <span className={"rounded-theme px-2 py-0.5 text-xs font-medium " + (b.is_active ? "bg-accentSubtle text-accent" : "bg-surfaceAlt text-inkSubtle")}>{b.is_active ? "Live" : "Off"}</span>
            <span className="rounded-theme bg-surfaceAlt px-2 py-0.5 text-xs text-inkMuted">{AUD_LABEL[b.audience] ?? b.audience}</span>
          </div>
          <p className="mt-1 text-sm text-inkMuted">{b.body}</p>
          <p className="mt-1 text-xs text-inkSubtle">{new Date(b.created_at).toLocaleString()}</p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <button disabled={busy} onClick={toggle} className="rounded-theme border border-border px-2.5 py-1 text-xs text-ink hover:bg-surfaceAlt disabled:opacity-50">{b.is_active ? "Turn off" : "Turn on"}</button>
          {!confirm ? (
            <button onClick={() => setConfirm(true)} className="rounded-theme border border-border px-2.5 py-1 text-xs text-inkMuted hover:bg-surfaceAlt">Delete</button>
          ) : (
            <>
              <button disabled={busy} onClick={remove} className="rounded-theme border border-red-300 bg-red-50 px-2.5 py-1 text-xs text-red-700 hover:bg-red-100 disabled:opacity-50">Confirm</button>
              <button disabled={busy} onClick={() => setConfirm(false)} className="rounded-theme border border-border px-2.5 py-1 text-xs text-inkMuted hover:bg-surfaceAlt">Cancel</button>
            </>
          )}
        </div>
      </div>
      {err ? <div className="mt-2 text-xs text-red-600">{err}</div> : null}
    </div>
  );
}
