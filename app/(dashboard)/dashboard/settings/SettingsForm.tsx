"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function SettingsForm({
  userId,
  email,
  fullName,
  forwarding,
}: {
  userId: string;
  email: string | null;
  fullName: string | null;
  forwarding: string | null;
}) {
  const router = useRouter();
  const [name, setName] = useState(fullName ?? "");
  const [address, setAddress] = useState(forwarding ?? "");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function save() {
    setBusy(true);
    setMsg(null);
    setErr(null);
    const supabase = createClient();

    const { error: e1 } = await supabase
      .from("profiles")
      .update({ full_name: name.trim() || null })
      .eq("id", userId);
    if (e1) { setBusy(false); setErr(e1.message); return; }

    const { error: e2 } = await supabase.rpc("update_my_forwarding_address", { p_address: address });
    if (e2) { setBusy(false); setErr(e2.message); return; }

    setBusy(false);
    setMsg("Saved.");
    router.refresh();
  }

  const label = "block text-xs font-medium text-inkMuted";
  const input = "mt-1 w-full rounded-theme border border-border bg-white px-3 py-2 text-sm outline-none focus:border-accent";

  return (
    <section className="rounded-theme border border-border bg-surface p-5">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-inkSubtle">Profile & forwarding</h2>
      <div className="mt-4 space-y-4">
        <div>
          <label className={label}>Email</label>
          <input value={email ?? ""} disabled className={input + " text-inkSubtle"} />
          <p className="mt-1 text-xs text-inkSubtle">Contact BIG Oakland to change your account email.</p>
        </div>
        <div>
          <label className={label}>Full name</label>
          <input value={name} onChange={(e) => setName(e.target.value)} className={input} placeholder="Your name" />
        </div>
        <div>
          <label className={label}>Default forwarding address</label>
          <textarea
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            rows={3}
            className={input}
            placeholder="Street, city, state, ZIP"
          />
          <p className="mt-1 text-xs text-inkSubtle">Used to prefill Forward requests. You can override it per piece.</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            disabled={busy}
            onClick={save}
            className="rounded-theme bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accentHover disabled:opacity-50"
          >
            {busy ? "Saving…" : "Save changes"}
          </button>
          {msg ? <span className="text-sm text-green-700">{msg}</span> : null}
          {err ? <span className="text-sm text-red-600">{err}</span> : null}
        </div>
      </div>
    </section>
  );
}
