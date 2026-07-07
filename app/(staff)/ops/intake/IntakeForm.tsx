"use client";
import { useState, useRef, useEffect } from "react";
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

type Phase = "idle" | "live" | "captured";

export default function IntakeForm() {
  const router = useRouter();

  // Pre-screen (A2)
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Match[]>([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState<Match | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // Capture flow (A3 Stamp → A4 Photograph)
  const [phase, setPhase] = useState<Phase>("idle");
  const [serial, setSerial] = useState<number | null>(null);
  const [captured, setCaptured] = useState<{ blob: Blob; url: string } | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);

  const [sender, setSender] = useState("");
  const [type, setType] = useState<string>("Letter");
  const [box, setBox] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => () => stopCamera(), []); // release camera on unmount

  // ---- Pre-screen search ----
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
  function pick(m: Match) { setSelected(m); setBox(String(m.box_number)); setResults([]); setQ(""); }
  function clearSelected() { setSelected(null); setBox(""); }

  // ---- Camera ----
  function stopCamera() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }
  async function startCamera() {
    setCameraError(null);
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError("Live camera not available on this device — use the photo picker below.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }
    } catch {
      setCameraError("Couldn't open the camera (permission or hardware). Use the photo picker below.");
    }
  }

  // ---- Piece lifecycle ----
  async function startPiece() {
    setMsg(null);
    setBusy(true);
    const supabase = createClient();
    const { data, error } = await supabase.rpc("reserve_serial");
    setBusy(false);
    if (error || data == null) { setMsg({ ok: false, text: `Couldn't reserve a serial: ${error?.message ?? "no value"}` }); return; }
    setSerial(Number(data));
    setCaptured(null);
    setPhase("live");
    startCamera();
  }

  function capturePhoto() {
    const v = videoRef.current, c = canvasRef.current;
    if (!v || !c || !v.videoWidth) return;
    c.width = v.videoWidth; c.height = v.videoHeight;
    c.getContext("2d")!.drawImage(v, 0, 0, c.width, c.height);
    c.toBlob((blob) => {
      if (!blob) return;
      stopCamera();
      setCaptured({ blob, url: URL.createObjectURL(blob) });
      setPhase("captured");
    }, "image/jpeg", 0.9);
  }

  function onFilePicked(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    stopCamera();
    setCaptured({ blob: f, url: URL.createObjectURL(f) });
    setPhase("captured");
  }

  function retake() {
    if (captured) URL.revokeObjectURL(captured.url);
    setCaptured(null);
    setPhase("live");
    startCamera();
  }

  function resetPiece() {
    stopCamera();
    if (captured) URL.revokeObjectURL(captured.url);
    setCaptured(null);
    setSerial(null);
    setPhase("idle");
    setSender(""); setBox(""); setSelected(null);
    if (fileRef.current) fileRef.current.value = "";
  }

  async function savePiece() {
    if (serial == null || !captured) return;
    setBusy(true); setMsg(null);
    const supabase = createClient();

    const path = `_unassigned/${serial}-${crypto.randomUUID()}.jpg`;
    const { error: upErr } = await supabase.storage
      .from("envelope-photos")
      .upload(path, captured.blob, { contentType: "image/jpeg", upsert: false });
    if (upErr) { setBusy(false); setMsg({ ok: false, text: `Photo upload failed: ${upErr.message}` }); return; }

    const { data, error } = await supabase
      .from("mail_pieces")
      .insert({
        serial,                    // bind the reserved (stamped) serial
        sender: sender || null,
        type,
        status: "Pending Verification",
        envelope_image: path,
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
    setMsg({ ok: true, text: `Logged piece #${data.serial} — Pending Verification${selected ? ` · pre-screened to box #${selected.box_number}` : ""}.` });
    if (captured) URL.revokeObjectURL(captured.url);
    setCaptured(null); setSerial(null); setPhase("idle");
    setSender(""); setBox(""); setSelected(null);
    if (fileRef.current) fileRef.current.value = "";
    router.refresh();
  }

  const input = "w-full rounded-theme border border-border bg-white px-3 py-2 text-sm text-ink outline-none focus:border-accent";

  return (
    <div className="space-y-4">
      {/* A2 Pre-screen */}
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
            <input value={q} onChange={(e) => onQueryChange(e.target.value)} placeholder="e.g. Raman, Acme, 512, 1300 Clay St" className={input + " mt-3"} />
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

      {/* A3 Stamp → A4 Photograph */}
      <section className="rounded-theme border border-border bg-surface p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-inkSubtle">Stamp &amp; photograph</h2>

        {phase === "idle" ? (
          <div className="mt-3">
            <p className="text-xs text-inkSubtle">Reserve the next serial, stamp it on the piece, then photograph.</p>
            <button disabled={busy} onClick={startPiece}
              className="mt-3 rounded-theme bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accentHover disabled:opacity-60">
              {busy ? "Reserving…" : "Start piece → reserve serial"}
            </button>
          </div>
        ) : (
          <>
            <div className="mt-3 rounded-theme border border-accent bg-accentSubtle p-3">
              <div className="text-xs uppercase tracking-wide text-inkSubtle">Stamp this ID on the piece</div>
              <div className="font-mono text-2xl font-bold tracking-wider text-ink">#{serial}</div>
              <div className="mt-0.5 text-xs text-inkSubtle">Confirm the stamped number matches, then capture the photo.</div>
            </div>

            {/* Viewfinder / preview */}
            <div className="mt-3 overflow-hidden rounded-theme border border-border bg-black/5">
              {phase === "captured" && captured ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={captured.url} alt={`Envelope #${serial}`} className="max-h-72 w-full object-contain" />
              ) : (
                <video ref={videoRef} playsInline muted className="max-h-72 w-full object-contain" />
              )}
            </div>
            <canvas ref={canvasRef} className="hidden" />

            {phase === "live" && (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <button onClick={capturePhoto} disabled={!!cameraError}
                  className="rounded-theme bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accentHover disabled:opacity-60">
                  Capture photo
                </button>
                <label className="cursor-pointer rounded-theme border border-border px-3 py-2 text-sm text-inkMuted hover:bg-surfaceAlt">
                  Use photo picker
                  <input ref={fileRef} type="file" accept="image/*" capture="environment" onChange={onFilePicked} className="hidden" />
                </label>
                <button onClick={resetPiece} className="rounded-theme border border-border px-3 py-2 text-sm text-inkMuted hover:bg-surfaceAlt">Discard</button>
                {cameraError && <p className="w-full text-xs text-amber-700">{cameraError}</p>}
              </div>
            )}

            {phase === "captured" && (
              <>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
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
                <div className="mt-3 sm:w-1/2">
                  <label className="mb-1 block text-xs font-medium text-inkMuted">Box # {selected ? "(from pre-screen)" : "(best guess, optional)"}</label>
                  <input value={box} onChange={(e) => setBox(e.target.value.replace(/[^0-9]/g, ""))} inputMode="numeric" placeholder="e.g. 512" className={input} />
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button disabled={busy} onClick={savePiece}
                    className="rounded-theme bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accentHover disabled:opacity-60">
                    {busy ? "Logging…" : `Log piece #${serial} → Pending Verification`}
                  </button>
                  <button onClick={retake} className="rounded-theme border border-border px-3 py-2 text-sm text-inkMuted hover:bg-surfaceAlt">Retake</button>
                  <button onClick={resetPiece} className="rounded-theme border border-border px-3 py-2 text-sm text-inkMuted hover:bg-surfaceAlt">Discard</button>
                </div>
              </>
            )}
          </>
        )}

        {msg && <p className={`mt-3 text-sm ${msg.ok ? "text-emerald-700" : "text-red-600"}`}>{msg.text}</p>}
      </section>
    </div>
  );
}
