import Link from "next/link";
import type { Profile } from "@/lib/auth";
import { roleHome } from "@/lib/auth";

const ROLE_LABEL: Record<string, string> = { customer: "Customer", staff: "Staff", admin: "Admin" };

export function AppShell({ profile, children }: { profile: Profile; children: React.ReactNode }) {
  const isStaff = profile.role === "staff" || profile.role === "admin";
  return (
    <div className="min-h-screen bg-bg">
      <header className="border-b border-border bg-surface">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-3">
          <div className="flex items-center gap-4">
            <Link href={roleHome(profile.role)} className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-theme bg-accent font-mono text-xs font-bold text-white">BO</span>
              <span className="font-serif font-semibold text-ink">Virtual Mail</span>
            </Link>
            <nav className="flex gap-1 text-sm">
              <Link href="/dashboard" className="rounded-theme px-2.5 py-1 text-inkMuted hover:bg-surfaceAlt">Portal</Link>
              {isStaff && <Link href="/ops" className="rounded-theme px-2.5 py-1 text-inkMuted hover:bg-surfaceAlt">Ops</Link>}
              {profile.role === "admin" && <Link href="/admin" className="rounded-theme px-2.5 py-1 text-inkMuted hover:bg-surfaceAlt">Admin</Link>}
            </nav>
          </div>
          <div className="flex items-center gap-3">
            <span className="rounded-theme bg-accentSubtle px-2.5 py-1 text-xs font-medium text-accent">{ROLE_LABEL[profile.role]}</span>
            <span className="hidden text-sm text-inkMuted sm:inline">{profile.full_name || profile.email}</span>
            <form action="/auth/signout" method="post">
              <button className="rounded-theme border border-border px-2.5 py-1 text-sm text-inkMuted hover:bg-surfaceAlt">Sign out</button>
            </form>
          </div>
        </div>
      </header>
      <div className="mx-auto max-w-5xl px-6 py-10">{children}</div>
    </div>
  );
}
