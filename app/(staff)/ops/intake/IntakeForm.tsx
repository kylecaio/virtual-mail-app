"use client";
import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const TYPES = ["Letter", "Postcard", "Magazine", "Large Envelope", "Package"] as const;

type Match = {
  id: string;
  box_number: number;
  name: string;
  company: string | null;
  email: string | null;
  status: string;
  forwarding_address: string | null;
  last_activity: string | null;
  score: number;
};

const STATUS_STYLE: Record<string, string> = {
  Active: "bg-emerald-100 text-emerald-800",
  "Past Due": "bg-amber-100 text-amber-800",
  "Pending Form 1583": "bg-amber-100 text-amber-800",
  Churned: "bg-gray-200 text-gray-600",
};
const isInactive = (s: string) => s !== "Active";

export default function IntakeForm() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [sender, setSender] = useState("");
  const [type, setType] = useState<string>("Letter");
  const [box, setBox] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  // Pre-screen (intake step 2)
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Match[]>([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState<Match | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  function onQueryChange(v: string) {
    setQ(v);
    if (timer.current) clearTimeout(timer.current);
    if (v.trim().length < 2) { setResults([]); return; }
    timer.current = setTimeout(async () => {
      setSearching(true);
      const supabase = createClient();
      const { data } = await supabase.rpc("search_customers", { q: v.trim() });
      setSearching(false);
      setResults((data as Match[]) ?? []);
    }, 250);
  }

  function pick(m: Match) {
    setSelected(m);
    setBox(String(m.box_number));
    setResults([]);
    setQ("");
  }
  function clearSelected() {
    setSelected(null);
    setBox("");
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setMsg(null);
    const supabase = createClient();

    let envelopePath: string | null = null;
    const file = fileRef.current?.files?.[0];
    if (file) {
      const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const path = `_unassigned/${crypto.randomUUID()}-${safe}`;
      const { error: upErr } = await supabase.storage.from("envelope-photos").upload(path, file, { upsert: false });
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
          prescreen: selected
            ? { customerId: selected.id, boxNumber: selected.box_number, name: selected.name, status: selected.status }
            : null,
        },
      })
      .select("serial")
      .single();

    setBusy(false);
    if (error) { setMsg({ ok: false, text: error.message }); return; }
    setMsg({ ok: true, text: `Logged mail piece #${data.serial} — Pending Verification${selected ? ` · pre-screened to #${selected.box_number}` : ""}.` });
    setSender(""); setType("Letter"); setBox(""); setSelected(null);
    if (fileRef.current) fileRef.current.value = "";
    router.refresh();
  }

  const input = "w-full rounded-theme border border-border bg-white px-3 py-2 text-sm text-ink outline-none focus:border-accent";

  return (
    <div className="space-y-4">
      {/* Pre-screen: search active + inactive customers */}
      <section className="rounded-theme border border-border bg-surface p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-inkSubtle">Pre-screen</h2>
        <p className="mt-1 text-xs text-inkSubtle">Search a partial name, company, PMB #, or address across all customers — active and inactive — before you stamp.</p>

        {selected ? (
          <div className="mt-3 flex items-start justify-between gap-3 rounded-theme border border-accent bg-accentSubtle p-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-ink">#{selected.box_number} · {selected.company || selected.name}</span>
                <span className={"rounded-theme px-2 py-0.5 text-xs font-medium " + (STATUS_STYLE[selected.status] ?? "bg-gray-200 text-gray-600")}>{selected.status}</span>
              </div>
              {isInactive(selected.status) ? (
                <div className="mt-0.5 text-xs text-amber-700">Inactive account — mail is “correct,” account is not. Return to sender + flag for win-back.</div>
              ) : (
                <div className="mt-0.5 text-xs text-inkSubtle">Will carry into assignment (box #{selected.box_number} pre-filled below).</div>
              )}
            </div>
            <button onClick={clearSelected} className="rounded-theme border border-border px-2 py-1 text-xs text-inkMuted hover:bg-surfaceAlt">Clear</button>
          </div>
        ) : (
          <>
            <input
              value={q}
              onChange={(e) => onQueryChange(e.target.value)}
              placeholder="e.g. Raman, Acme, 512, 1300 Clay St"
              className={input + " mt-3"}
            />
            {q.trim().length >= 2 && (
              <div className="mt-2 overflow-hidden rounded-theme border border-border">
                {searching && results.length === 0 ? (
                  <div className="px-3 py-3 text-xs text-inkSubtle">Searching…</div>
                ) : results.length === 0 ? (
                  <div className="px-3 py-3 text-xs text-inkSubtle">No match — likely not our mail. Set aside for Return to Sender.</div>
                ) : (
                  <ul className="divide-y divide-border">
                    {results.map((m) => (
                      <li key={m.id}>
                        <button type="button" onClick={() => pick(m)} className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left hover:bg-surfaceAlt">
                          <span>
                            <span className="text-sm font-medium text-ink">#{m.box_number} · {m.company || m.name}</span>
                            {m.company && m.name ? <span className="text-xs text-inkSubtle"> · {m.name}</span> : null}
                            <span className="block text-xs text-inkSubtle">{m.last_activity ? `last active ${m.last_activity}` : "no activity on file"}</span>
                          </span>
                          <span className={"shrink-0 rounded-theme px-2 py-0.5 text-xs font-medium " + (STATUS_STYLE[m.status] ?? "bg-gray-200 text-gray-600")}>{m.status}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </>
        )}
      </section>

      {/* Log the piece */}
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
          <label className="mb-1 block text-xs font-medium text-inkMuted">Box # {selected ? "(from pre-screen)" : "(best guess, optional)"}</label>
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
    </div>
  );
}
