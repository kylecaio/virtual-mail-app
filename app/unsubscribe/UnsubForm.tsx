"use client";
import { useState } from "react";
import { updatePrefsByToken, type UnsubPrefs } from "./actions";

export default function UnsubForm({ token, initial }: { token: string; initial: UnsubPrefs }) {
  const [p, setP] = useState<UnsubPrefs>(initial);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function save(next: UnsubPrefs) {
    setBusy(true); setMsg(null); setErr(null);
    const res = await updatePrefsByToken(token, next);
    setBusy(false);
    if (!res.ok) { setErr(res.error ?? "Failed"); return; }
    setP(next);
    setMsg("Your preferences have been updated.");
  }

  const rows: { k: keyof UnsubPrefs; label: string; desc: string }[] = [
    { k: "mail", label: "Mail activity", desc: "Received, scanned, forwarded, shredded, recycled, picked up." },
    { k: "requests", label: "Request updates", desc: "Acknowledgements when you request an action." },
    { k: "billing", label: "Billing receipts", desc: "Payments, credit packs, and overage charges." },
    { k: "marketing", label: "News & offers", desc: "Occasional product news and promotions." },
  ];

  return (
    <div className="rounded-theme border border-border bg-surface p-5">
      <div className="divide-y divide-border">
        {rows.map((r) => (
          <label key={r.k} className="flex items-start gap-3 py-2.5">
            <input
              type="checkbox"
              checked={p[r.k]}
              onChange={(e) => setP({ ...p, [r.k]: e.target.checked })}
              className="mt-1"
            />
            <span>
              <span className="text-sm font-medium text-ink">{r.label}</span>
              <span className="block text-xs text-inkSubtle">{r.desc}</span>
            </span>
          </label>
        ))}
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          disabled={busy}
          onClick={() => save(p)}
          className="rounded-theme bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accentHover disabled:opacity-50"
        >
          {busy ? "Saving…" : "Save preferences"}
        </button>
        <button
          disabled={busy}
          onClick={() => save({ mail: false, requests: false, billing: false, marketing: false })}
          className="rounded-theme border border-border px-4 py-2 text-sm text-inkMuted hover:bg-surfaceAlt disabled:opacity-50"
        >
          Unsubscribe from all optional email
        </button>
        {msg ? <span className="text-sm text-green-700">{msg}</span> : null}
        {err ? <span className="text-sm text-red-600">{err}</span> : null}
      </div>
      <p className="mt-3 text-xs text-inkSubtle">Critical account and payment-failure emails are always sent.</p>
    </div>
  );
}
