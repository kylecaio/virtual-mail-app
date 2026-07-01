import Link from "next/link";

const CARDS = [
  { href: "/dashboard", title: "Customer Portal", body: "Your inbox and mail actions: scan, forward, shred, recycle, pickup." },
  { href: "/ops", title: "Staff & Ops", body: "Intake and fulfillment queues for BIG Oakland staff." },
  { href: "/status", title: "System Status", body: "Live check of the Supabase-backed foundation." },
];

export default function Home() {
  return (
    <main className="min-h-screen bg-bg">
      <header className="border-b border-border bg-surface">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-theme bg-accent font-mono text-sm font-bold text-white">BO</div>
            <div>
              <div className="font-serif text-lg font-semibold text-ink">BIG Oakland · Virtual Mail</div>
              <div className="text-xs text-inkSubtle">123 Broadway, Oakland, CA 94607</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/login" className="rounded-theme px-3 py-1.5 text-sm text-inkMuted hover:bg-surfaceAlt">Sign in</Link>
            <Link href="/signup" className="rounded-theme bg-accent px-3 py-1.5 text-sm font-medium text-white hover:bg-accentHover">Get a mailbox</Link>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-5xl px-6 py-16">
        <h1 className="max-w-2xl font-serif text-4xl font-semibold leading-tight text-ink">
          Your Oakland street address, managed from anywhere.
        </h1>
        <p className="mt-4 max-w-xl text-inkMuted">
          Rent a real mailbox. We receive and photograph your mail — you decide:
          scan, forward, shred, recycle, or pick up.
        </p>

        <div className="mt-10 grid gap-4 sm:grid-cols-3">
          {CARDS.map((c) => (
            <Link key={c.title} href={c.href}
              className="rounded-theme border border-border bg-surface p-5 transition hover:border-borderStrong hover:shadow-sm">
              <div className="font-medium text-ink">{c.title}</div>
              <p className="mt-1 text-sm text-inkMuted">{c.body}</p>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
