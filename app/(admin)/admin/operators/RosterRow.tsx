"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { logAudit } from "@/lib/audit";

type P = { id: string; email: string | null; full_name: string | null; role: string; display_name: string | null; active: boolean | null; onRoster: boolean };

export default function RosterRow({ p }: { p: P }) {
  const router = useRouter();
  const [displayName, setDisplayName] = useState(p.display_name ?? p.full_name ?? "");
  const [active, setActive] = useState(p.active ?? true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function save() {
    setBusy(true); setErr(null); setSaved(false);
    const supabase = createClient();
    const { error } = await supabase.from("operators").upsert(
      { id: p.id, display_name: displayName.trim() || null, active },
      { onConflict: "id" },
    );
    if (error) { setBusy(false); setErr(error.message); return; }
    await logAudit(supabase, {
      action: "operator.roster.upsert", entity: "operators", entity_id: p.id,
      detail: { email: p.email, display_name: displayName.trim() || null, active },
    });
    setBusy(false); setSaved(true);
    router.refresh();
  }

  const inp = "rounded-theme border border-border bg-surface px-2 py-1 text-sm outline-none focus:border-accent";
  return (
    <tr className="border-t border-border align-middle">
      <td className="px-3 py-2 text-ink">{p.email}</td>
      <td className="px-3 py-2"><span className="rounded-theme bg-accentSubtle px-2 py-0.5 text-xs font-medium text-accent">{p.role}</span></td>
      <td className="px-3 py-2"><input className={inp + " w-48"} value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder={p.full_name ?? "display name"} /></td>
      <td className="px-3 py-2 text-center"><input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} /></td>
      <td className="px-3 py-2 text-right whitespace-nowrap">
        <button disabled={busy} onClick={save} className="rounded-theme bg-accent px-3 py-1 text-xs font-medium text-white hover:bg-accentHover disabled:opacity-50">Save</button>
        {saved && !err ? <span className="ml-2 text-xs text-green-700">Saved</span> : null}
        {!p.onRoster && !saved ? <span className="ml-2 text-xs text-inkSubtle">not on roster</span> : null}
        {err ? <div className="mt-0.5 text-xs text-red-600">{err}</div> : null}
      </td>
    </tr>
  );
}
