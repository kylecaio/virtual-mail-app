export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-bg px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-theme bg-accent font-mono text-sm font-bold text-white">BO</div>
          <div>
            <div className="font-serif text-lg font-semibold text-ink">BIG Oakland · Virtual Mail</div>
            <div className="text-xs text-inkSubtle">123 Broadway, Oakland, CA 94607</div>
          </div>
        </div>
        <div className="rounded-theme border border-border bg-surface p-6 shadow-sm">{children}</div>
      </div>
    </main>
  );
}
