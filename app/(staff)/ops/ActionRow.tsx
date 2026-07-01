"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const MAP: Record<string, string> = {
  Scan: "Scanned", Forward: "Forwarded", Shred: "Shredded", Recycle: "Recycled", Pickup: "Picked Up",
};

export default function ActionRow({ piece }: { piece: any }) {
  const router = useRouter();
  const [tracking, setTracking] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function fulfil(action: keyof typeof MAP) {
    setBusy(true); setErr(null);
    const supabase = createClient();
    const now = new Date().toISOString();

    const update: Record<string, any> = { status: MAP[action], request: action, completed_at: now };
    if (piece.status === "Received") update.requested_at = now; // staff-initiated
    if (action === "Forward" && tracking) update.tracking = tracking;

    const { error: e1 } = await supabase.from("mail_pieces").update(update).eq("serial", piece.serial);
    if (e1) { setBusy(false); setErr(e1.message); return; }

    await supabase.from("service_requests").insert({
      mail_piece_id: piece.id,
      serial: piece.serial,
      customer_id: piece.customer_id ?? null,
      type: action,
      status: "Completed",
      completed_at: now,
      tracking: action === "Forward" && tracking ? tracking : null,
    });

    setBusy(false);
    router.refresh();
  }

  const cust = piece.customer ? `#${piece.customer.box_number} ${piece.customer.name}` : "—";
  const btn = "rounded-theme border border-border px-2 py-1 text-xs text-ink hover:bg-surfaceAlt disabled:opacity-50";

  return (
    <tr className="border-t border-border align-top">
      <td className="px-4 py-2 font-mono text-ink">#{piece.serial}</td>
      <td className="px-4 py-2 text-inkMuted">{cust}</td>
      <td className="px-4 py-2 text-inkMuted">{piece.sender || "—"}</td>
      <td className="px-4 py-2 text-inkMuted">{piece.status}</td>
      <td className="px-4 py-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <button disabled={busy} className={btn} onClick={() => fulfil("Scan")}>Scan</button>
          <button disabled={busy} className={btn} onClick={() => fulfil("Forward")}>Forward</button>
          <input value={tracking} onChange={(e) => setTracking(e.target.value)} placeholder="tracking #"
            className="w-24 rounded-theme border border-border px-2 py-1 text-xs outline-none focus:border-accent" />
          <button disabled={busy} className={btn} onClick={() => fulfil("Shred")}>Shred</button>
          <button disabled={busy} className={btn} onClick={() => fulfil("Recycle")}>Recycle</button>
          <button disabled={busy} className={btn} onClick={() => fulfil("Pickup")}>Pickup</button>
        </div>
        {err ? <div className="mt-0.5 text-xs text-red-600">{err}</div> : null}
      </td>
    </tr>
  );
}
