"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { logAudit } from "@/lib/audit";

const AUDIENCE = [
  { v: "all", label: "All customers" },
  { v: "active", label: "Active customers" },
  { v: "past_due", label: "Past-due customers" },
];

export default function BroadcastComposer() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [audience, setAudience] = useState("all");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function post() {
    if (!title.trim() || !body.trim()) { setErr("Title and message are required."); return; }
    setBusy(true); setErr(null);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const { data, error } = await supabase
      .from("broadcasts")
      .insert({ title: title.trim(), body: body.trim(), audience, is_active: true, created_by: user?.id ?? null })
      .select("id").single();
    if (error) { setBusy(false); setErr(error.message); return; }
    await logAudit(supabase, {
      action: "broadcast.create", entity: "broadcasts", entity_id: data?.id ?? null,
      detail: { title: title.trim(), audience },
    });
    setBusy(false); setTitle(""); setBody(""); setAudience("all");
    router.refresh();
  }

  const inp = "w-full rounded-theme border border-border bg-surface px-2.5 py-1.5 text-sm outline-none focus:border-accent";
  return (
    <div className="rounded-theme border border-border bg-surface p-4">
      <div className="grid gap-3">
        <div className="flex flex-col gap-1">
          <label className="text-xs text-inkMuted">Title</label>
          <input className={inp} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Holiday hours" />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-inkMuted">Message</label>
          <textarea className={inp + " min-h-[80px]"} value={body} onChange={(e) => setBody(e.target.value)} placeholder="Shown as a banner on the customer dashboard." />
        </div>
        <div className="flex items-end justify-between gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-xs text-inkMuted">Audience</label>
            <select className="rounded-theme border border-border bg-surface px-2.5 py-1.5 text-sm outline-none focus:border-accent" value={audience} onChange={(e) => setAudience(e.target.value)}>
              {AUDIENCE.map((a) => <option key={a.v} value={a.v}>{a.label}</option>)}
            </select>
          </div>
          <button disabled={busy} onClick={post} className="rounded-theme bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accentHover disabled:opacity-50">Post broadcast</button>
        </div>
        {err ? <div className="text-xs text-red-600">{err}</div> : null}
      </div>
    </div>
  );
}
