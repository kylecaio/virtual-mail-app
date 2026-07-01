"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { logAudit } from "@/lib/audit";

type Grant = { email: string; role: string; note: string | null; created_at: string };

export default function GrantRow({ grant, selfEmail }: { grant: Grant; selfEmail: string | null }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [confirm, setConfirm] = useState(false);
  const isSelf = selfEmail != null && selfEmail.toLowerCase() === grant.email.toLowerCase();

  async function remove() {
    setBusy(true); setErr(null);
    const supabase = createClient();
    const { error: dErr } = await supabase.from("role_grants").delete().eq("email", grant.email);
    if (dErr) { setBusy(false); setErr(dErr.message); return; }

    // Downgrade any existing account for that email to customer.
    const { data: prof } = await supabase.from("profiles").select("id, role").eq("email", grant.email).maybeSingle();
    let downgraded = false;
    if (prof && prof.role !== "customer") {
      const { error: pErr } = await supabase.from("profiles").update({ role: "customer" }).eq("id", prof.id);
      if (pErr) { setBusy(false); setErr(pErr.message); return; }
      downgraded = true;
    }

    await logAudit(supabase, {
      action: "operator.grant.remove", entity: "role_grants", entity_id: grant.email,
      detail: { email: grant.email, was_role: grant.role, downgraded_existing_account: downgraded },
    });
    setBusy(false);
    router.refresh();
  }

  return (
    <tr className="border-t border-border align-middle">
      <td className="px-3 py-2 text-ink">{grant.email}{isSelf ? <span className="ml-2 text-xs text-inkSubtle">(you)</span> : null}</td>
      <td className="px-3 py-2"><span className="rounded-theme bg-accentSubtle px-2 py-0.5 text-xs font-medium text-accent">{grant.role}</span></td>
      <td className="px-3 py-2 text-inkMuted">{grant.note || "—"}</td>
      <td className="px-3 py-2 text-inkSubtle">{new Date(grant.created_at).toLocaleDateString()}</td>
      <td className="px-3 py-2 text-right">
        {isSelf ? (
          <span className="text-xs text-inkSubtle">protected</span>
        ) : !confirm ? (
          <button onClick={() => setConfirm(true)} className="rounded-theme border border-border px-2.5 py-1 text-xs text-ink hover:bg-surfaceAlt">Remove</button>
        ) : (
          <span className="inline-flex items-center gap-1.5">
            <button disabled={busy} onClick={remove} className="rounded-theme border border-red-300 bg-red-50 px-2.5 py-1 text-xs text-red-700 hover:bg-red-100 disabled:opacity-50">Confirm remove</button>
            <button disabled={busy} onClick={() => setConfirm(false)} className="rounded-theme border border-border px-2.5 py-1 text-xs text-inkMuted hover:bg-surfaceAlt">Cancel</button>
          </span>
        )}
        {err ? <div className="mt-0.5 text-xs text-red-600">{err}</div> : null}
      </td>
    </tr>
  );
}
