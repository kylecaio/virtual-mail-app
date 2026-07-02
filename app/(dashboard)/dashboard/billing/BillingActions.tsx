"use client";
import { useState } from "react";

async function startCheckout(payload: Record<string, unknown>): Promise<string> {
  const res = await fetch("/api/stripe/checkout", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data?.url) throw new Error(data?.error || "Could not start checkout");
  return data.url as string;
}

const primary =
  "rounded-theme bg-accent px-3 py-1.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50";
const secondary =
  "rounded-theme border border-border px-3 py-1.5 text-sm font-medium text-ink hover:bg-surfaceAlt disabled:opacity-50";

export function SubscribeButton({ planId, label }: { planId: string; label: string }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  return (
    <>
      <button
        className={primary}
        disabled={busy}
        onClick={async () => {
          setBusy(true); setErr(null);
          try { window.location.href = await startCheckout({ kind: "subscription", planId }); }
          catch (e: any) { setErr(e.message); setBusy(false); }
        }}
      >
        {busy ? "…" : label}
      </button>
      {err ? <div className="mt-1 text-xs text-red-600">{err}</div> : null}
    </>
  );
}

export function BuyPackButton({ packageId }: { packageId: string }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  return (
    <>
      <button
        className={secondary}
        disabled={busy}
        onClick={async () => {
          setBusy(true); setErr(null);
          try { window.location.href = await startCheckout({ kind: "package", packageId }); }
          catch (e: any) { setErr(e.message); setBusy(false); }
        }}
      >
        {busy ? "…" : "Buy"}
      </button>
      {err ? <div className="mt-1 text-xs text-red-600">{err}</div> : null}
    </>
  );
}

export function ManageBillingButton() {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  return (
    <>
      <button
        className={secondary}
        disabled={busy}
        onClick={async () => {
          setBusy(true); setErr(null);
          try {
            const res = await fetch("/api/stripe/portal", { method: "POST" });
            const data = await res.json().catch(() => ({}));
            if (!res.ok || !data?.url) throw new Error(data?.error || "Could not open billing portal");
            window.location.href = data.url;
          } catch (e: any) { setErr(e.message); setBusy(false); }
        }}
      >
        {busy ? "…" : "Manage subscription / card"}
      </button>
      {err ? <div className="mt-1 text-xs text-red-600">{err}</div> : null}
    </>
  );
}
