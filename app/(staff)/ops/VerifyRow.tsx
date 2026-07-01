"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Customer = { id: string; box_number: number; name: string; company: string | null };

export default function VerifyRow({ piece, customers }: { piece: any; customers: Customer[] }) {
  const router = useRouter();
  const guess = piece.extraction?.boxGuess ?? null;
  const guessed = useMemo(() => customers.find((c) => c.box_number === Number(guess)), [customers, guess]);
  const [sel, setSel] = useState<string>(guessed?.id ?? "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function update(fields: Record<string, any>) {
    setBusy(true); setErr(null);
    const supabase = createClient();
    const { error } = await supabase.from("mail_pieces").update(fields).eq("serial", piece.serial);
    setBusy(false);
    if (error) { setErr(error.message); return; }
    router.refresh();
  }

  return (
    <tr className="border-t border-border align-top">
      <td className="px-4 py-2 font-mono text-ink">#{piece.serial}</td>
      <td className="px-4 py-2 text-inkMuted">{piece.sender || "—"}</td>
      <td className="px-4 py-2 text-inkMuted">{piece.type || "—"}</td>
      <td className="px-4 py-2">
        <select value={sel} onChange={(e) => setSel(e.target.value)}
          className="w-full rounded-theme border border-border bg-white px-2 py-1 text-sm outline-none focus:border-accent">
          <option value="">Select customer…</option>
          {customers.map((c) => (
            <option key={c.id} value={c.id}>#{c.box_number} · {c.company || c.name}</option>
          ))}
        </select>
        {guess ? <div className="mt-0.5 text-xs text-inkSubtle">guess: box {guess}</div> : null}
        {err ? <div className="mt-0.5 text-xs text-red-600">{err}</div> : null}
      </td>
      <td className="px-4 py-2">
        <div className="flex flex-wrap gap-1.5">
          <button disabled={busy || !sel} onClick={() => update({ customer_id: sel, status: "Received" })}
            className="rounded-theme bg-accent px-2.5 py-1 text-xs font-medium text-white hover:bg-accentHover disabled:opacity-50">Verify</button>
          <button disabled={busy} onClick={() => update({ status: "Address Correction" })}
            className="rounded-theme border border-border px-2.5 py-1 text-xs text-inkMuted hover:bg-surfaceAlt disabled:opacity-50">Addr. correction</button>
          <button disabled={busy} onClick={() => update({ status: "Return to Sender" })}
            className="rounded-theme border border-border px-2.5 py-1 text-xs text-inkMuted hover:bg-surfaceAlt disabled:opacity-50">Return to sender</button>
        </div>
      </td>
    </tr>
  );
}
