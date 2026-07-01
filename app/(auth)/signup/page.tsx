"use client";
import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export default function SignupPage() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setMsg(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName },   // role is NOT accepted here; assigned server-side
        emailRedirectTo: `${window.location.origin}/auth/confirm?next=/auth/post-login`,
      },
    });
    setBusy(false);
    setMsg(error ? error.message : "Account created. Check your email to confirm, then sign in.");
  }

  return (
    <div>
      <h1 className="font-serif text-xl font-semibold text-ink">Create account</h1>
      <p className="mt-1 text-sm text-inkMuted">For customers renting a mailbox.</p>
      <form onSubmit={onSubmit} className="mt-4 space-y-3">
        <input type="text" placeholder="Full name" value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          className="w-full rounded-theme border border-border bg-white px-3 py-2 text-sm text-ink outline-none focus:border-accent" />
        <input type="email" required placeholder="you@example.com" value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded-theme border border-border bg-white px-3 py-2 text-sm text-ink outline-none focus:border-accent" />
        <input type="password" required minLength={8} placeholder="Password (8+ chars)" value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full rounded-theme border border-border bg-white px-3 py-2 text-sm text-ink outline-none focus:border-accent" />
        <button disabled={busy} type="submit"
          className="w-full rounded-theme bg-accent px-3 py-2 text-sm font-medium text-white hover:bg-accentHover disabled:opacity-60">
          {busy ? "…" : "Create account"}
        </button>
      </form>
      {msg && <p className="mt-3 text-sm text-inkMuted">{msg}</p>}
      <p className="mt-4 text-sm text-inkMuted">
        Already have an account? <Link href="/login" className="text-accent hover:text-accentHover">Sign in</Link>
      </p>
    </div>
  );
}
