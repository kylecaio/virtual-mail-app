"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { logAudit } from "@/lib/audit";
import type { PricingRule } from "@/lib/pricing";

const num = "w-20 rounded-theme border border-border bg-surface px-2 py-1 text-right text-sm outline-none focus:border-accent";

// Human labels for the service_type keys.
const LABEL: Record<string, string> = {
  scan: "Standard scan", express_scan: "Express scan", shred: "Shred",
  forward_handling: "Forward handling", consolidation: "Consolidation",
  local_pickup: "Local pickup", storage_daily: "Storage (daily)",
  storage_monthly_cap: "Storage (monthly cap)", sales_tax: "Sales tax",
};

export default function RuleRow({ rule }: { rule: PricingRule }) {
  const router = useRouter();
  const [f, setF] = useState({
    base_amount: String(rule.base_amount),
    included_units: String(rule.included_units),
    overage_amount: rule.overage_amount == null ? "" : String(rule.overage_amount),
    min_charge: rule.min_charge == null ? "" : String(rule.min_charge),
    max_charge: rule.max_charge == null ? "" : String(rule.max_charge),
    is_active: rule.is_active,
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
      base_amount: Number(f.base_amount),
      included_units: parseInt(f.included_units, 10),
      overage_amount: f.overage_amount === "" ? null : Number(f.overage_amount),
      min_charge: f.min_charge === "" ? null : Number(f.min_charge),
      max_charge: f.max_charge === "" ? null : Number(f.max_charge),
      is_active: f.is_active,
    };
    const { error } = await supabase.from("pricing_rules").update(patch).eq("id", rule.id);
    if (error) { setBusy(false); setErr(error.message); return; }
    await logAudit(supabase, {
      action: "pricing.rule.update", entity: "pricing_rules", entity_id: rule.id,
      detail: { service_type: rule.service_type, before: { base_amount: rule.base_amount, included_units: rule.included_units, overage_amount: rule.overage_amount, min_charge: rule.min_charge, max_charge: rule.max_charge, is_active: rule.is_active }, after: patch },
    });
    setBusy(false); setSaved(true);
    router.refresh();
  }

  const unit = rule.charge_type === "percentage" ? "%" : "$";
  return (
    <tr className="border-t border-border align-middle">
      <td className="px-3 py-2 text-ink">{LABEL[rule.service_type] ?? rule.service_type}<div className="text-xs text-inkSubtle">{rule.charge_type}</div></td>
      <td className="px-3 py-2"><div className="flex items-center gap-1"><span className="text-xs text-inkSubtle">{unit}</span><input className={num} value={f.base_amount} onChange={set("base_amount")} inputMode="decimal" /></div></td>
      <td className="px-3 py-2"><input className={num} value={f.included_units} onChange={set("included_units")} inputMode="numeric" /></td>
      <td className="px-3 py-2"><input className={num} value={f.overage_amount} onChange={set("overage_amount")} placeholder="—" inputMode="decimal" /></td>
      <td className="px-3 py-2"><input className={num} value={f.min_charge} onChange={set("min_charge")} placeholder="—" inputMode="decimal" /></td>
      <td className="px-3 py-2"><input className={num} value={f.max_charge} onChange={set("max_charge")} placeholder="—" inputMode="decimal" /></td>
      <td className="px-3 py-2 text-center"><input type="checkbox" checked={f.is_active} onChange={set("is_active")} /></td>
      <td className="px-3 py-2 whitespace-nowrap">
        <button disabled={busy} onClick={save} className="rounded-theme bg-accent px-3 py-1 text-xs font-medium text-white hover:bg-accentHover disabled:opacity-50">Save</button>
        {saved && !err ? <span className="ml-2 text-xs text-green-700">Saved</span> : null}
        {err ? <div className="mt-0.5 text-xs text-red-600">{err}</div> : null}
      </td>
    </tr>
  );
}
