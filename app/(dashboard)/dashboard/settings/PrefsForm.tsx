"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Prefs = { mail: boolean; requests: boolean; billing: boolean; marketing: boolean };

export default function PrefsForm({ initial }: { initial: Prefs }) {
  const router = useRouter();
  const [p, setP] = useState<Prefs>(initial);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function save() {
    setBusy(true); setMsg(null); setErr(null);
    const supabase = createClient();
    const { error } = await supabase.rpc("update_my_notification_prefs", {
      p_mail: p.mail, p_requests: p.requests, p_billing: p.billing, p_marketing: p.marketing,
    });
    setBusy(false);
    if (error) { setErr(error.message); return; }
    setMsg("Saved."); router.refresh();
  }

  const rows: { k: keyof Prefs; label: string; desc: string }[] = [
    { k: "mail", label: "Mail activity", desc: "Received, scanned, forwarded, shredded, recycled, picked up." },
    { k: "requests", label: "Request updates", desc: "Acknowledgements when you request an action." },
    { k: "billing", label: "Billing receipts", desc: "Payments, credit packs, and overage charges." },
    { k: "marketing", label: "News & offers", desc: "Occasional product news and promotions." },
  ];

  return (
    <section className="rounded-theme border border-border bg-surface p-5">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-inkSubtle">Email notifications</h2>
      <p className="mt-1 text-xs text-inkSubtle">Critical account and payment-failure emails are always sent.</p>
      <div className="mt-3 divide-y divide-border">
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
      <div className="mt-4 flex items-center gap-3">
        <button
          disabled={busy}
          onClick={save}
          className="rounded-theme bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accentHover disabled:opacity-50"
        >
          {busy ? "Saving…" : "Save preferences"}
        </button>
        {msg ? <span className="text-sm text-green-700">{msg}</span> : null}
        {err ? <span className="text-sm text-red-600">{err}</span> : null}
      </div>
    </section>
  );
}
