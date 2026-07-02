"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { logAudit } from "@/lib/audit";

const inp = "rounded-theme border border-border bg-surface px-2 py-1 text-sm outline-none focus:border-accent";

// service_type keys align with the credit ledger / pricing rule keys.
const SERVICE_TYPES = ["scan", "express_scan", "shred", "forward", "local_pickup", "consolidation"];

export default function PackageCreate() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ name: "", service_type: "scan", quantity: "10", bonus: "0", price: "", stripe_price_id: "" });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const set = (k: keyof typeof f) => (e: any) => setF({ ...f, [k]: e.target.value });

  async function create() {
    setBusy(true); setErr(null);
    const supabase = createClient();
    const row = {
      name: f.name.trim(),
      service_type: f.service_type,
      quantity: parseInt(f.quantity, 10),
      bonus: parseInt(f.bonus || "0", 10),
      price: Number(f.price),
      stripe_price_id: f.stripe_price_id.trim() === "" ? null : f.stripe_price_id.trim(),
    };
    if (!row.name || !row.quantity || !row.price) { setBusy(false); setErr("Name, quantity, and price are required."); return; }
    const { data, error } = await supabase.from("packages").insert(row).select("id").maybeSingle();
    if (error) { setBusy(false); setErr(error.message); return; }
    await logAudit(supabase, {
      action: "pricing.package.create", entity: "packages", entity_id: (data as any)?.id ?? null, detail: { created: row },
    });
    setBusy(false); setOpen(false);
    setF({ name: "", service_type: "scan", quantity: "10", bonus: "0", price: "", stripe_price_id: "" });
    router.refresh();
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="rounded-theme border border-border px-3 py-1.5 text-sm font-medium text-ink hover:bg-surfaceAlt">
        + New pack
      </button>
    );
  }

  return (
    <div className="rounded-theme border border-border bg-surfaceAlt p-4">
      <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-6">
        <label className="text-xs text-inkSubtle">Name
          <input className={inp + " mt-1 w-full"} value={f.name} onChange={set("name")} placeholder="10 scans" />
        </label>
        <label className="text-xs text-inkSubtle">Action type
          <select className={inp + " mt-1 w-full"} value={f.service_type} onChange={set("service_type")}>
            {SERVICE_TYPES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </label>
        <label className="text-xs text-inkSubtle">Quantity
          <input className={inp + " mt-1 w-full"} value={f.quantity} onChange={set("quantity")} inputMode="numeric" />
        </label>
        <label className="text-xs text-inkSubtle">Bonus
          <input className={inp + " mt-1 w-full"} value={f.bonus} onChange={set("bonus")} inputMode="numeric" />
        </label>
        <label className="text-xs text-inkSubtle">Price $
          <input className={inp + " mt-1 w-full"} value={f.price} onChange={set("price")} inputMode="decimal" />
        </label>
        <label className="text-xs text-inkSubtle">Stripe price id
          <input className={inp + " mt-1 w-full font-mono text-xs"} value={f.stripe_price_id} onChange={set("stripe_price_id")} placeholder="price_…" />
        </label>
      </div>
      <div className="mt-3 flex items-center gap-2">
        <button disabled={busy} onClick={create} className="rounded-theme bg-accent px-3 py-1.5 text-sm font-medium text-white hover:bg-accentHover disabled:opacity-50">Create pack</button>
        <button disabled={busy} onClick={() => setOpen(false)} className="rounded-theme border border-border px-3 py-1.5 text-sm text-ink hover:bg-surface">Cancel</button>
        {err ? <span className="text-xs text-red-600">{err}</span> : null}
      </div>
      <p className="mt-2 text-xs text-inkSubtle">After creating, create a matching one-time Stripe Price and paste its id so customers can buy the pack.</p>
    </div>
  );
}
