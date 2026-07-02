"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { logAudit } from "@/lib/audit";
import type { Package } from "@/lib/pricing";

const inp = "w-full rounded-theme border border-border bg-surface px-2 py-1 text-sm outline-none focus:border-accent";
const num = "w-16 rounded-theme border border-border bg-surface px-2 py-1 text-right text-sm outline-none focus:border-accent";

export default function PackageRow({ pkg }: { pkg: Package }) {
  const router = useRouter();
  const [f, setF] = useState({
    name: pkg.name,
    service_type: pkg.service_type,
    quantity: String(pkg.quantity),
    bonus: String(pkg.bonus),
    price: String(pkg.price),
    stripe_price_id: pkg.stripe_price_id ?? "",
    display_order: String(pkg.display_order),
    is_active: pkg.is_active,
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
      service_type: f.service_type.trim(),
      quantity: parseInt(f.quantity, 10),
      bonus: parseInt(f.bonus || "0", 10),
      price: Number(f.price),
      stripe_price_id: f.stripe_price_id.trim() === "" ? null : f.stripe_price_id.trim(),
      display_order: parseInt(f.display_order || "0", 10),
      is_active: f.is_active,
    };
    const { error } = await supabase.from("packages").update(patch).eq("id", pkg.id);
    if (error) { setBusy(false); setErr(error.message); return; }
    await logAudit(supabase, {
      action: "pricing.package.update", entity: "packages", entity_id: pkg.id,
      detail: { before: pkg, after: patch },
    });
    setBusy(false); setSaved(true);
    router.refresh();
  }

  async function remove() {
    if (!confirm(`Delete pack "${pkg.name}"?`)) return;
    setBusy(true); setErr(null);
    const supabase = createClient();
    const { error } = await supabase.from("packages").delete().eq("id", pkg.id);
    if (error) { setBusy(false); setErr(error.message); return; }
    await logAudit(supabase, {
      action: "pricing.package.delete", entity: "packages", entity_id: pkg.id, detail: { deleted: pkg },
    });
    router.refresh();
  }

  return (
    <tr className="border-t border-border align-middle">
      <td className="px-3 py-2"><input className={inp} value={f.name} onChange={set("name")} /></td>
      <td className="px-3 py-2"><input className={inp + " font-mono text-xs"} value={f.service_type} onChange={set("service_type")} placeholder="scan" /></td>
      <td className="px-3 py-2"><input className={num} value={f.quantity} onChange={set("quantity")} inputMode="numeric" /></td>
      <td className="px-3 py-2"><input className={num} value={f.bonus} onChange={set("bonus")} inputMode="numeric" /></td>
      <td className="px-3 py-2"><div className="flex items-center gap-1"><span className="text-xs text-inkSubtle">$</span><input className={num} value={f.price} onChange={set("price")} inputMode="decimal" /></div></td>
      <td className="px-3 py-2"><input className="w-40 rounded-theme border border-border bg-surface px-2 py-1 font-mono text-xs outline-none focus:border-accent" value={f.stripe_price_id} onChange={set("stripe_price_id")} placeholder="price_…" /></td>
      <td className="px-3 py-2"><input className="w-12 rounded-theme border border-border bg-surface px-2 py-1 text-right text-sm outline-none focus:border-accent" value={f.display_order} onChange={set("display_order")} inputMode="numeric" /></td>
      <td className="px-3 py-2 text-center"><input type="checkbox" checked={f.is_active} onChange={set("is_active")} /></td>
      <td className="px-3 py-2 whitespace-nowrap">
        <button disabled={busy} onClick={save} className="rounded-theme bg-accent px-3 py-1 text-xs font-medium text-white hover:bg-accentHover disabled:opacity-50">Save</button>
        <button disabled={busy} onClick={remove} className="ml-2 rounded-theme border border-border px-2 py-1 text-xs text-red-600 hover:bg-surfaceAlt disabled:opacity-50">Delete</button>
        {saved && !err ? <span className="ml-2 text-xs text-green-700">Saved</span> : null}
        {err ? <div className="mt-0.5 text-xs text-red-600">{err}</div> : null}
      </td>
    </tr>
  );
}
