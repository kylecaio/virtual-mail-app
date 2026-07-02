"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { adminAdjustBilling } from "./actions";

const money = (n: number) => `$${Number(n).toFixed(2)}`;

export default function BillingAdminRow({ row }: { row: any }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const reversible = row.status !== "Refunded" && row.status !== "Waived";

  async function act(kind: "refund" | "waive") {
    if (!confirm(`${kind === "refund" ? "Refund" : "Waive"} ${money(row.amount)} for ${row.customer_name ?? "customer"}?`)) return;
    setBusy(true); setErr(null);
    const res = await adminAdjustBilling(row.id, kind);
    if (!res.ok) { setErr(res.error); setBusy(false); return; }
    setBusy(false);
    router.refresh();
  }

  const btn = "rounded-theme border border-border px-2 py-1 text-xs text-ink hover:bg-surfaceAlt disabled:opacity-50";

  return (
    <tr className="border-t border-border align-top">
      <td className="px-3 py-2 text-inkMuted">{new Date(row.date).toLocaleDateString()}</td>
      <td className="px-3 py-2 text-ink">{row.customer_name ?? "—"}</td>
      <td className="px-3 py-2 text-inkMuted">{row.description || row.type}</td>
      <td className="px-3 py-2 text-inkMuted">{row.type}</td>
      <td className="px-3 py-2 text-inkMuted capitalize">{row.source || "—"}</td>
      <td className="px-3 py-2 text-inkMuted">{row.status}</td>
      <td className="px-3 py-2 text-right font-medium text-ink">{money(row.amount)}</td>
      <td className="px-3 py-2 whitespace-nowrap">
        {reversible ? (
          <>
            <button disabled={busy} className={btn} onClick={() => act("refund")}>Refund</button>
            <button disabled={busy} className={btn + " ml-1"} onClick={() => act("waive")}>Waive</button>
          </>
        ) : (
          <span className="text-xs text-inkSubtle">—</span>
        )}
        {err ? <div className="mt-0.5 text-xs text-red-600">{err}</div> : null}
      </td>
    </tr>
  );
}
