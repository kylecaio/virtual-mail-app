"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { logAudit } from "@/lib/audit";
import type { Plan } from "@/lib/pricing";

const inp = "w-full rounded-theme border border-border bg-surface px-2 py-1 text-sm outline-none focus:border-accent";
const num = "w-20 rounded-theme border border-border bg-surface px-2 py-1 text-right text-sm outline-none focus:border-accent";

export default function PlanRow({ plan }: { plan: Plan }) {
  const router = useRouter();
  const [f, setF] = useState({
    name: plan.name,
    monthly_price: String(plan.monthly_price),
    annual_price: plan.annual_price == null ? "" : String(plan.annual_price),
    included_items: String(plan.included_items),
    overage_rate: String(plan.overage_rate),
    free_storage_days: String(plan.free_storage_days),
    display_order: String(plan.display_order),
    is_active: plan.is_active,
  });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const set = (k: keyof typeof f) => (e: any) =>
    setF({ ...f, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value });

  async function save() {
    setBusy(true); setErr(null); setSaved(false);
    const supabase = createClient();
    const patch = {
      name: f.name.trim(),
      monthly_price: Number(f.monthly_price),
      annual_price: f.annual_price === "" ? null : Number(f.annual_price),
      included_items: parseInt(f.included_items, 10),
      overage_rate: Number(f.overage_rate),
      free_storage_days: parseInt(f.free_storage_days, 10),
      display_order: parseInt(f.display_order, 10),
      is_active: f.is_active,
    };
    const { error } = await supabase.from("plans").update(patch).eq("id", plan.id);
    if (error) { setBusy(false); setErr(error.message); return; }
    await logAudit(supabase, {
      action: "pricing.plan.update", entity: "plans", entity_id: plan.id,
      detail: { before: { name: plan.name, monthly_price: plan.monthly_price, annual_price: plan.annual_price, included_items: plan.included_items, overage_rate: plan.overage_rate, free_storage_days: plan.free_storage_days, display_order: plan.display_order, is_active: plan.is_active }, after: patch },
    });
    setBusy(false); setSaved(true);
    router.refresh();
  }

  return (
    <tr className="border-t border-border align-middle">
      <td className="px-3 py-2"><input className={inp} value={f.name} onChange={set("name")} /></td>
      <td className="px-3 py-2"><input className={num} value={f.monthly_price} onChange={set("monthly_price")} inputMode="decimal" /></td>
      <td className="px-3 py-2"><input className={num} value={f.annual_price} onChange={set("annual_price")} placeholder="—" inputMode="decimal" /></td>
      <td className="px-3 py-2"><input className={num} value={f.included_items} onChange={set("included_items")} inputMode="numeric" /></td>
      <td className="px-3 py-2"><input className={num} value={f.overage_rate} onChange={set("overage_rate")} inputMode="decimal" /></td>
      <td className="px-3 py-2"><input className={num} value={f.free_storage_days} onChange={set("free_storage_days")} inputMode="numeric" /></td>
      <td className="px-3 py-2"><input className="w-14 rounded-theme border border-border bg-surface px-2 py-1 text-right text-sm outline-none focus:border-accent" value={f.display_order} onChange={set("display_order")} inputMode="numeric" /></td>
      <td className="px-3 py-2 text-center"><input type="checkbox" checked={f.is_active} onChange={set("is_active")} /></td>
      <td className="px-3 py-2 whitespace-nowrap">
        <button disabled={busy} onClick={save} className="rounded-theme bg-accent px-3 py-1 text-xs font-medium text-white hover:bg-accentHover disabled:opacity-50">Save</button>
        {saved && !err ? <span className="ml-2 text-xs text-green-700">Saved</span> : null}
        {err ? <div className="mt-0.5 text-xs text-red-600">{err}</div> : null}
      </td>
    </tr>
  );
}
