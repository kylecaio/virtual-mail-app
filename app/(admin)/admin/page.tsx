import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import AdminNav from "./AdminNav";

export const dynamic = "force-dynamic";

const CARDS = [
  { href: "/admin/pricing", title: "Pricing editor", desc: "Plans, per-action rates, and carrier margins. Publicly readable; admin-writable." },
  { href: "/admin/operators", title: "Operators", desc: "Grant staff/admin access and manage the staff roster." },
  { href: "/admin/reports", title: "Reports", desc: "Revenue, pieces, requests, and subscriptions over time." },
  { href: "/admin/broadcast", title: "Broadcast", desc: "Post an in-app banner to customers." },
  { href: "/admin/audit", title: "Audit log", desc: "Every admin action, newest first." },
];

export default async function AdminHome() {
  const p = await requireAdmin();
  const supabase = createClient();

  const [plans, rules, margins, grants, broadcasts, audit] = await Promise.all([
    supabase.from("plans").select("id", { count: "exact", head: true }),
    supabase.from("pricing_rules").select("id", { count: "exact", head: true }),
    supabase.from("shipping_margins").select("id", { count: "exact", head: true }),
    supabase.from("role_grants").select("email", { count: "exact", head: true }),
    supabase.from("broadcasts").select("id", { count: "exact", head: true }).eq("is_active", true),
    supabase.from("audit_log").select("id", { count: "exact", head: true }),
  ]);

  const stat = "rounded-theme border border-border bg-surface px-4 py-3";
  return (
    <div>
      <h1 className="font-serif text-2xl font-semibold text-ink">Admin</h1>
      <p className="mt-1 text-inkMuted">Signed in as {p.email}. Manage pricing, access, reporting, and customer messaging.</p>

      <AdminNav />

      <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <div className={stat}><div className="text-2xl font-semibold text-ink">{plans.count ?? 0}</div><div className="text-xs text-inkMuted">Plans</div></div>
        <div className={stat}><div className="text-2xl font-semibold text-ink">{rules.count ?? 0}</div><div className="text-xs text-inkMuted">Pricing rules</div></div>
        <div className={stat}><div className="text-2xl font-semibold text-ink">{margins.count ?? 0}</div><div className="text-xs text-inkMuted">Carrier rates</div></div>
        <div className={stat}><div className="text-2xl font-semibold text-ink">{grants.count ?? 0}</div><div className="text-xs text-inkMuted">Access grants</div></div>
        <div className={stat}><div className="text-2xl font-semibold text-ink">{broadcasts.count ?? 0}</div><div className="text-xs text-inkMuted">Live broadcasts</div></div>
        <div className={stat}><div className="text-2xl font-semibold text-ink">{audit.count ?? 0}</div><div className="text-xs text-inkMuted">Audit entries</div></div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {CARDS.map((c) => (
          <Link key={c.href} href={c.href} className="rounded-theme border border-border bg-surface p-4 transition hover:border-borderStrong hover:bg-surfaceAlt">
            <div className="font-serif text-lg font-semibold text-ink">{c.title}</div>
            <div className="mt-1 text-sm text-inkMuted">{c.desc}</div>
          </Link>
        ))}
      </div>
    </div>
  );
}
