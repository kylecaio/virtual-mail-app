"use client";
import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const TYPES = ["Letter", "Postcard", "Magazine", "Large Envelope", "Package"] as const;

export default function IntakeForm() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [sender, setSender] = useState("");
  const [type, setType] = useState<string>("Letter");
  const [box, setBox] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setMsg(null);
    const supabase = createClient();

    let envelopePath: string | null = null;
    const file = fileRef.current?.files?.[0];
    if (file) {
      const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const path = `_unassigned/${crypto.randomUUID()}-${safe}`;
      const { error: upErr } = await supabase.storage
        .from("envelope-photos")
        .upload(path, file, { upsert: false });
      if (upErr) { setBusy(false); setMsg({ ok: false, text: `Photo upload failed: ${upErr.message}` }); return; }
      envelopePath = path;
    }

    const { data, error } = await supabase
      .from("mail_pieces")
      .insert({
        sender: sender || null,
        type,
        status: "Pending Verification",
        envelope_image: envelopePath,
        extraction: {
          source: "manual_intake",
          senderGuess: sender || null,
          typeGuess: type,
          boxGuess: box ? Number(box) : null,
        },
      })
      .select("serial")
      .single();

    setBusy(false);
    if (error) { setMsg({ ok: false, text: error.message }); return; }
    setMsg({ ok: true, text: `Logged mail piece #${data.serial} — Pending Verification.` });
    setSender(""); setType("Letter"); setBox("");
    if (fileRef.current) fileRef.current.value = "";
    router.refresh();
  }

  const input = "w-full rounded-theme border border-border bg-white px-3 py-2 text-sm text-ink outline-none focus:border-accent";

  return (
    <form onSubmit={onSubmit} className="space-y-3 rounded-theme border border-border bg-surface p-5">
      <div>
        <label className="mb-1 block text-xs font-medium text-inkMuted">Envelope photo</label>
        <input ref={fileRef} type="file" accept="image/*" capture="environment"
          className="block w-full text-sm text-inkMuted file:mr-3 file:rounded-theme file:border-0 file:bg-accentSubtle file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-accent" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs font-medium text-inkMuted">Sender</label>
          <input value={sender} onChange={(e) => setSender(e.target.value)} placeholder="e.g. Kaiser Permanente" className={input} />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-inkMuted">Type</label>
          <select value={type} onChange={(e) => setType(e.target.value)} className={input}>
            {TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
      </div>
      <div className="sm:w-1/2">
        <label className="mb-1 block text-xs font-medium text-inkMuted">Box # (best guess, optional)</label>
        <input value={box} onChange={(e) => setBox(e.target.value.replace(/[^0-9]/g, ""))} inputMode="numeric" placeholder="e.g. 512" className={input} />
      </div>
      <button disabled={busy} type="submit"
        className="rounded-theme bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accentHover disabled:opacity-60">
        {busy ? "Logging…" : "Log piece → Pending Verification"}
      </button>
      {msg && (
        <p className={`text-sm ${msg.ok ? "text-emerald-700" : "text-red-600"}`}>{msg.text}</p>
      )}
    </form>
  );
}
