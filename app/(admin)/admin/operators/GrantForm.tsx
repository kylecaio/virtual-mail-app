"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { logAudit } from "@/lib/audit";

export default function GrantForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"staff" | "admin">("staff");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  async function add() {
    const e = email.trim().toLowerCase();
    if (!e) { setErr("Enter an email."); return; }
    setBusy(true); setErr(null); setMsg(null);
    const supabase = createClient();

    const { error: gErr } = await supabase
      .from("role_grants")
      .upsert({ email: e, role, note: note.trim() || null }, { onConflict: "email" });
    if (gErr) { setBusy(false); setErr(gErr.message); return; }

    // If the person already has an account, apply the role now (else handle_new_user
    // assigns it from the allowlist on signup).
    const { data: prof } = await supabase.from("profiles").select("id, role").eq("email", e).maybeSingle();
    let applied = false;
    if (prof && prof.role !== role) {
      const { error: pErr } = await supabase.from("profiles").update({ role }).eq("id", prof.id);
      if (pErr) { setBusy(false); setErr(pErr.message); return; }
      applied = true;
    }

    await logAudit(supabase, {
      action: "operator.grant.add", entity: "role_grants", entity_id: e,
      detail: { email: e, role, note: note.trim() || null, applied_to_existing_account: applied },
    });

    setBusy(false);
    setMsg(applied ? `Granted ${role} — applied to existing account.` : `Granted ${role} — applies on signup.`);
    setEmail(""); setNote("");
    router.refresh();
  }

  const inp = "rounded-theme border border-border bg-surface px-2.5 py-1.5 text-sm outline-none focus:border-accent";
  return (
    <div className="rounded-theme border border-border bg-surface p-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1">
          <label className="text-xs text-inkMuted">Email</label>
          <input className={inp + " w-64"} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="person@bigoakland.space" />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-inkMuted">Role</label>
          <select className={inp} value={role} onChange={(e) => setRole(e.target.value as any)}>
            <option value="staff">staff</option>
            <option value="admin">admin</option>
          </select>
        </div>
        <div className="flex flex-1 flex-col gap-1">
          <label className="text-xs text-inkMuted">Note (optional)</label>
          <input className={inp + " w-full"} value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. mailroom lead" />
        </div>
        <button disabled={busy} onClick={add} className="rounded-theme bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accentHover disabled:opacity-50">Add grant</button>
      </div>
      {msg ? <div className="mt-2 text-xs text-green-700">{msg}</div> : null}
      {err ? <div className="mt-2 text-xs text-red-600">{err}</div> : null}
    </div>
  );
}
