"use client";
import { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LoginForm() {
  const params = useSearchParams();
  const [mode, setMode] = useState<"password" | "magic">("password");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState<string | null>(params.get("error"));
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setMsg(null);
    const supabase = createClient();
    if (mode === "password") {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) { setMsg(error.message); setBusy(false); return; }
      window.location.assign("/auth/post-login");
    } else {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: `${window.location.origin}/auth/confirm?next=/auth/post-login` },
      });
      setBusy(false);
      setMsg(error ? error.message : "Check your email for a sign-in link.");
    }
  }

  return (
    <div>
      <h1 className="font-serif text-xl font-semibold text-ink">Sign in</h1>
      <div className="mt-4 flex rounded-theme border border-border p-0.5 text-sm">
        {(["password", "magic"] as const).map((m) => (
          <button key={m} type="button" onClick={() => setMode(m)}
            className={`flex-1 rounded-[7px] px-3 py-1.5 ${mode === m ? "bg-accentSubtle font-medium text-accent" : "text-inkMuted"}`}>
            {m === "password" ? "Password" : "Magic link"}
          </button>
        ))}
      </div>
      <form onSubmit={onSubmit} className="mt-4 space-y-3">
        <input type="email" required placeholder="you@example.com" value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded-theme border border-border bg-white px-3 py-2 text-sm text-ink outline-none focus:border-accent" />
        {mode === "password" && (
          <input type="password" required placeholder="Password" value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-theme border border-border bg-white px-3 py-2 text-sm text-ink outline-none focus:border-accent" />
        )}
        <button disabled={busy} type="submit"
          className="w-full rounded-theme bg-accent px-3 py-2 text-sm font-medium text-white hover:bg-accentHover disabled:opacity-60">
          {busy ? "…" : mode === "password" ? "Sign in" : "Send magic link"}
        </button>
      </form>
      {msg && <p className="mt-3 text-sm text-inkMuted">{msg}</p>}
      <p className="mt-4 text-sm text-inkMuted">
        New customer? <Link href="/signup" className="text-accent hover:text-accentHover">Create an account</Link>
      </p>
    </div>
  );
}
