"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { chargeAndFulfil, type ChargeInput } from "./charge";
import type { BillableAction } from "@/lib/pricing";

export default function ActionRow({ piece }: { piece: any }) {
  const router = useRouter();
  const [tracking, setTracking] = useState("");
  const [pages, setPages] = useState("");
  const [postage, setPostage] = useState("");
  const [express, setExpress] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  async function fulfil(action: BillableAction) {
    setBusy(true); setErr(null); setNote(null);
    const input: ChargeInput = {
      pieceId: piece.id,
      action,
      pages: pages ? parseInt(pages, 10) : undefined,
      express: action === "Scan" ? express : undefined,
      postage: action === "Forward" && postage ? Number(postage) : undefined,
      tracking: action === "Forward" && tracking ? tracking : undefined,
    };
    try {
      const res = await chargeAndFulfil(input);
      if (!res.ok) {
        setErr(res.error);
        setBusy(false);
        return;
      }
      const via =
        res.outcome === "free" ? "no charge" :
        res.outcome === "credit" ? "paid with credit" :
        res.outcome === "balance" ? `$${res.total.toFixed(2)} from balance` :
        `$${res.total.toFixed(2)} to card`;
      setNote(`${action} done — ${via}`);
      setBusy(false);
      router.refresh();
    } catch (e: any) {
      setErr(e?.message || "Failed");
      setBusy(false);
    }
  }

  const cust = piece.customer ? `#${piece.customer.box_number} ${piece.customer.name}` : "—";
  const btn = "rounded-theme border border-border px-2 py-1 text-xs text-ink hover:bg-surfaceAlt disabled:opacity-50";
  const small = "w-16 rounded-theme border border-border px-2 py-1 text-xs outline-none focus:border-accent";

  return (
    <tr className="border-t border-border align-top">
      <td className="px-4 py-2 font-mono text-ink">#{piece.serial}</td>
      <td className="px-4 py-2 text-inkMuted">{cust}</td>
      <td className="px-4 py-2 text-inkMuted">{piece.sender || "—"}</td>
      <td className="px-4 py-2 text-inkMuted">{piece.status}</td>
      <td className="px-4 py-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <button disabled={busy} className={btn} onClick={() => fulfil("Scan")}>Scan</button>
          <label className="flex items-center gap-1 text-xs text-inkSubtle">
            <input type="checkbox" checked={express} onChange={(e) => setExpress(e.target.checked)} />express
          </label>
          <input value={pages} onChange={(e) => setPages(e.target.value)} placeholder="pages" inputMode="numeric" className={small} />
          <button disabled={busy} className={btn} onClick={() => fulfil("Forward")}>Forward</button>
          <input value={postage} onChange={(e) => setPostage(e.target.value)} placeholder="postage $" inputMode="decimal" className={small} />
          <input value={tracking} onChange={(e) => setTracking(e.target.value)} placeholder="tracking #"
            className="w-24 rounded-theme border border-border px-2 py-1 text-xs outline-none focus:border-accent" />
          <button disabled={busy} className={btn} onClick={() => fulfil("Shred")}>Shred</button>
          <button disabled={busy} className={btn} onClick={() => fulfil("Recycle")}>Recycle</button>
          <button disabled={busy} className={btn} onClick={() => fulfil("Pickup")}>Pickup</button>
        </div>
        {note ? <div className="mt-0.5 text-xs text-green-700">{note}</div> : null}
        {err ? <div className="mt-0.5 text-xs text-red-600">{err}</div> : null}
      </td>
    </tr>
  );
}
