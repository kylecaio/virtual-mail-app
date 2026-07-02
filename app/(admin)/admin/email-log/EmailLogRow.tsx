"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { resendEmail } from "./actions";

type Row = {
  id: number;
  created_at: string;
  event: string;
  recipient: string;
  status: string;
  provider_id: string | null;
  error: string | null;
};

const STATUS_STYLE: Record<string, string> = {
  sent: "bg-green-100 text-green-800",
  sending: "bg-amber-100 text-amber-800",
  failed: "bg-red-100 text-red-800",
  skipped: "bg-gray-100 text-gray-600",
};

export default function EmailLogRow({ row }: { row: Row }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  async function resend() {
    setBusy(true); setNote(null);
    const res = await resendEmail(row.id);
    setBusy(false);
    setNote(res.ok ? "Resent." : res.error ?? "Failed");
    if (res.ok) router.refresh();
  }

  const canResend = row.status === "failed" || row.status === "skipped";

  return (
    <tr className="border-t border-border align-top">
      <td className="px-3 py-2 whitespace-nowrap text-inkSubtle">{new Date(row.created_at).toLocaleString()}</td>
      <td className="px-3 py-2 text-ink">{row.event}</td>
      <td className="px-3 py-2 text-inkMuted">{row.recipient}</td>
      <td className="px-3 py-2">
        <span className={"rounded-theme px-2 py-0.5 text-xs font-medium " + (STATUS_STYLE[row.status] ?? "bg-gray-100 text-gray-600")}>
          {row.status}
        </span>
      </td>
      <td className="px-3 py-2 text-xs text-red-600">{row.error ?? ""}</td>
      <td className="px-3 py-2 whitespace-nowrap">
        {canResend ? (
          <button
            disabled={busy}
            onClick={resend}
            className="rounded-theme border border-border px-2.5 py-1 text-xs text-ink hover:bg-surfaceAlt disabled:opacity-50"
          >
            {busy ? "Resending…" : "Resend"}
          </button>
        ) : null}
        {note ? <span className="ml-2 text-xs text-inkSubtle">{note}</span> : null}
      </td>
    </tr>
  );
}
