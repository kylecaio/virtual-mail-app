"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { StatusBadge } from "@/lib/ui/MailStatus";

type Piece = {
  id: string;
  serial: number;
  sender: string | null;
  type: string | null;
  status: string;
  received_at: string;
  envelope_image: string | null;
  scan_pdf: string | null;
};

const ACTIONS = ["Scan", "Forward", "Shred", "Recycle", "Pickup"] as const;
type Action = (typeof ACTIONS)[number];

const DESTRUCTIVE: Action[] = ["Shred", "Recycle"];

export default function RequestRow({ piece, defaultForwarding }: { piece: Piece; defaultForwarding: string | null }) {
  const router = useRouter();
  const [pending, setPending] = useState<Action | null>(null);
  const [address, setAddress] = useState(defaultForwarding ?? "");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  function start(action: Action) {
    setErr(null);
    setNotes("");
    setAddress(defaultForwarding ?? "");
    setPending(action);
  }

  function cancel() {
    setPending(null);
    setErr(null);
  }

  async function confirm() {
    if (!pending) return;
    if (pending === "Forward" && !address.trim()) {
      setErr("Enter a forwarding address.");
      return;
    }
    setBusy(true);
    setErr(null);
    const supabase = createClient();
    const { error } = await supabase.rpc("request_service", {
      p_mail_piece_id: piece.id,
      p_type: pending,
      p_forwarding_address: pending === "Forward" ? address.trim() : null,
      p_notes: notes.trim() || null,
    });
    setBusy(false);
    if (error) {
      setErr(error.message);
      return;
    }
    setPending(null);
    router.refresh();
  }

  const received = new Date(piece.received_at).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  const btn = "rounded-theme border border-border px-2.5 py-1 text-xs text-ink hover:bg-surfaceAlt disabled:opacity-50";

  return (
    <tr className="border-t border-border align-top">
      <td className="px-4 py-3 font-mono text-ink">
        #{piece.serial}
        {piece.envelope_image ? <span title="Envelope photo on file" className="ml-1">📷</span> : null}
      </td>
      <td className="px-4 py-3 text-inkMuted">{piece.sender || "—"}</td>
      <td className="px-4 py-3 text-inkMuted">{piece.type || "—"}</td>
      <td className="px-4 py-3 text-inkMuted">{received}</td>
      <td className="px-4 py-3">
        <StatusBadge status={piece.status} />
        {piece.scan_pdf ? <div className="mt-1 text-xs text-inkSubtle">Scan ready</div> : null}
      </td>
      <td className="px-4 py-3">
        {pending === null ? (
          <div className="flex flex-wrap gap-1.5">
            {ACTIONS.map((a) => (
              <button key={a} className={btn} onClick={() => start(a)}>{a}</button>
            ))}
          </div>
        ) : (
          <div className="max-w-sm space-y-2">
            <div className="text-xs font-medium text-ink">
              {pending === "Forward" && "Forward this piece to:"}
              {pending === "Scan" && "Request a scan of this piece?"}
              {pending === "Pickup" && "Schedule this piece for local pickup?"}
              {DESTRUCTIVE.includes(pending) && `${pending} this piece? This cannot be undone.`}
            </div>

            {pending === "Forward" && (
              <textarea
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                rows={2}
                placeholder="Street, city, state, ZIP"
                className="w-full rounded-theme border border-border px-2 py-1 text-sm outline-none focus:border-accent"
              />
            )}

            <input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Note for staff (optional)"
              className="w-full rounded-theme border border-border px-2 py-1 text-xs outline-none focus:border-accent"
            />

            <div className="flex gap-1.5">
              <button
                disabled={busy}
                onClick={confirm}
                className="rounded-theme bg-accent px-3 py-1 text-xs font-medium text-white hover:bg-accentHover disabled:opacity-50"
              >
                {busy ? "Sending…" : `Confirm ${pending}`}
              </button>
              <button disabled={busy} onClick={cancel} className={btn}>Cancel</button>
            </div>
          </div>
        )}
        {err ? <div className="mt-1 text-xs text-red-600">{err}</div> : null}
      </td>
    </tr>
  );
}
