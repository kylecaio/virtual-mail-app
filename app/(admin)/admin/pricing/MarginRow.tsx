"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { logAudit } from "@/lib/audit";
import type { ShippingMargin } from "@/lib/pricing";

const num = "w-24 rounded-theme border border-border bg-surface px-2 py-1 text-right text-sm outline-none focus:border-accent";

export default function MarginRow({ margin }: { margin: ShippingMargin }) {
  const router = useRouter();
  const pct = (m: number) => String(Math.round((Number(m) - 1) * 1000) / 10); // 1.20 -> "20"
  const [f, setF] = useState({
    marginPct: pct(margin.margin_multiplier),
    handling_fee: String(margin.handling_fee),
    is_active: margin.is_active,
  });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const set = (k: keyof typeof f) => (e: any) =>
    setF({ ...f, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value });

  async function save() {
    setBusy(true); setErr(null); setSaved(false);
    const supabase = createClient();
    const multiplier = Math.round((1 + Number(f.marginPct) / 100) * 1000) / 1000;
    const patch = { margin_multiplier: multiplier, handling_fee: Number(f.handling_fee), is_active: f.is_active };
    const { error } = await supabase.from("shipping_margins").update(patch).eq("id", margin.id);
    if (error) { setBusy(false); setErr(error.message); return; }
    await logAudit(supabase, {
      action: "pricing.margin.update", entity: "shipping_margins", entity_id: margin.id,
      detail: { carrier: margin.carrier, service_type: margin.service_type, before: { margin_multiplier: margin.margin_multiplier, handling_fee: margin.handling_fee, is_active: margin.is_active }, after: patch },
    });
    setBusy(false); setSaved(true);
    router.refresh();
  }

  return (
    <tr className="border-t border-border align-middle">
      <td className="px-3 py-2 text-ink">{margin.service_type}</td>
      <td className="px-3 py-2"><div className="flex items-center justify-end gap-1"><span className="text-xs text-inkSubtle">+</span><input className="w-16 rounded-theme border border-border bg-surface px-2 py-1 text-right text-sm outline-none focus:border-accent" value={f.marginPct} onChange={set("marginPct")} inputMode="decimal" /><span className="text-xs text-inkSubtle">%</span></div></td>
      <td className="px-3 py-2"><div className="flex items-center justify-end gap-1"><span className="text-xs text-inkSubtle">$</span><input className={num} value={f.handling_fee} onChange={set("handling_fee")} inputMode="decimal" /></div></td>
      <td className="px-3 py-2 text-center"><input type="checkbox" checked={f.is_active} onChange={set("is_active")} /></td>
      <td className="px-3 py-2 whitespace-nowrap">
        <button disabled={busy} onClick={save} className="rounded-theme bg-accent px-3 py-1 text-xs font-medium text-white hover:bg-accentHover disabled:opacity-50">Save</button>
        {saved && !err ? <span className="ml-2 text-xs text-green-700">Saved</span> : null}
        {err ? <div className="mt-0.5 text-xs text-red-600">{err}</div> : null}
      </td>
    </tr>
  );
}
