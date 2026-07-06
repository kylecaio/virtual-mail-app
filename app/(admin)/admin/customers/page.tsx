import Link from "next/link";
import { requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import AdminNav from "../AdminNav";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 100;

const money = (n: number | null | undefined) => `$${(Number(n) || 0).toFixed(2)}`;
const th = "px-3 py-2 text-left text-xs font-medium uppercase tracking-wide text-inkSubtle";
const thr = "px-3 py-2 text-right text-xs font-medium uppercase tracking-wide text-inkSubtle";

// Match the intake pre-screen badges exactly (ops/intake/IntakeForm.tsx STATUS_STYLE).
const STATUS_STYLE: Record<string, string> = {
  Active: "bg-emerald-100 text-emerald-800",
  "Past Due": "bg-amber-100 text-amber-800",
  "Pending Form 1583": "bg-amber-100 text-amber-800",
  Churned: "bg-gray-200 text-gray-600",
};
const badgeClass = (s: string) => STATUS_STYLE[s] ?? "bg-gray-200 text-gray-600";
const isInactive = (s: string | null) => (s ?? "") !== "Active";

type Row = {
  id: string;
  box_number: number | null;
  company: string | null;
  name: string | null;
  email: string | null;
  status: string | null;
  plan_id: string | null;
  account_balance: number | null;
  last_activity: string | null;
  created_at: string | null;
};

const COLS = "id, box_number, company, name, email, status, plan_id, account_balance, last_activity, created_at";
const fmtDate = (d: string | null) => (d ? new Date(d).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric", timeZone: "UTC" }) : "—");

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: { status?: string; q?: string; page?: string };
}) {
  await requireStaff();
  const supabase = createClient();

  const statusParam = (searchParams.status ?? "all").trim();
  const q = (searchParams.q ?? "").trim();
  const page = Math.max(1, Number(searchParams.page) || 1);

  // --- Counts for the segmented control + per-status chips (RLS-safe, light: one text column) ---
  const { data: statusRows } = await supabase.from("customers").select("status").limit(10000);
  const perStatus: Record<string, number> = {};
  let total = 0,
    activeCount = 0;
  for (const r of (statusRows ?? []) as { status: string | null }[]) {
    total++;
    const s = r.status ?? "—";
    perStatus[s] = (perStatus[s] ?? 0) + 1;
    if (r.status === "Active") activeCount++;
  }
  const inactiveCount = total - activeCount;

  // Plan id → name
  const { data: plans } = await supabase.from("plans").select("id, name").order("display_order");
  const planName = new Map((plans ?? []).map((p: any) => [p.id, p.name]));

  // --- Rows: search (fuzzy RPC) overrides status filter; otherwise filtered + paginated ---
  let rows: Row[] = [];
  let listCount = 0; // total matching the current filter (for pagination)
  let searchMode = false;

  if (q) {
    searchMode = true;
    // Ranked fuzzy match across active + inactive; RPC returns a subset of columns,
    // so re-fetch full rows by id (RLS-safe) and preserve the RPC's ranking order.
    const { data: matches } = await supabase.rpc("search_customers", { q });
    const ids = ((matches as { id: string }[]) ?? []).map((m) => m.id);
    if (ids.length) {
      const { data: full } = await supabase.from("customers").select(COLS).in("id", ids);
      const byId = new Map(((full as Row[]) ?? []).map((r) => [r.id, r]));
      rows = ids.map((id) => byId.get(id)).filter(Boolean) as Row[];
    }
    listCount = rows.length;
  } else {
    let query = supabase.from("customers").select(COLS, { count: "exact" });
    if (statusParam === "active") query = query.eq("status", "Active");
    else if (statusParam === "inactive") query = query.neq("status", "Active");
    else if (statusParam !== "all") query = query.eq("status", statusParam); // exact-status chip
    const from = (page - 1) * PAGE_SIZE;
    const { data, count } = await query
      .order("box_number", { ascending: true, nullsFirst: false })
      .range(from, from + PAGE_SIZE - 1);
    rows = (data as Row[]) ?? [];
    listCount = count ?? 0;
  }

  const totalPages = Math.max(1, Math.ceil(listCount / PAGE_SIZE));
  const rangeStart = listCount === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const rangeEnd = Math.min(page * PAGE_SIZE, listCount);

  // --- UI helpers ---
  const seg = (key: string, label: string, count: number) => {
    const active = !q && statusParam === key;
    return (
      <Link
        key={key}
        href={key === "all" ? "/admin/customers" : `/admin/customers?status=${encodeURIComponent(key)}`}
        className={
          "rounded-theme px-3 py-1.5 text-sm font-medium " +
          (active ? "bg-accent text-white" : "bg-surfaceAlt text-inkMuted hover:text-ink")
        }
      >
        {label} <span className={active ? "opacity-90" : "text-inkSubtle"}>({count})</span>
      </Link>
    );
  };

  // Per-status chips: whatever statuses actually exist, in a sensible order.
  const KNOWN = ["Active", "Past Due", "Pending Form 1583", "Churned"];
  const chipStatuses = [
    ...KNOWN.filter((s) => perStatus[s]),
    ...Object.keys(perStatus).filter((s) => !KNOWN.includes(s)).sort(),
  ];

  return (
    <div>
      <h1 className="font-serif text-2xl font-semibold text-ink">Customers</h1>
      <p className="mt-1 text-inkMuted">
        The full roster — active and inactive. Inactive accounts stay visible for win-back
        (&ldquo;the mail was correct, the account is not&rdquo;).
      </p>

      <AdminNav />

      {/* Segmented control */}
      <div className="mb-3 flex flex-wrap items-center gap-1.5">
        {seg("all", "All", total)}
        {seg("active", "Active", activeCount)}
        {seg("inactive", "Inactive", inactiveCount)}
        {chipStatuses.length > 0 && <span className="mx-1 h-5 w-px bg-border" />}
        {chipStatuses.map((s) => (
          <Link
            key={s}
            href={`/admin/customers?status=${encodeURIComponent(s)}`}
            className={
              "rounded-theme px-2.5 py-1 text-xs font-medium " +
              (!q && statusParam === s ? "ring-1 ring-accent " : "") +
              badgeClass(s)
            }
          >
            {s} ({perStatus[s]})
          </Link>
        ))}
      </div>

      {/* Search */}
      <form method="GET" action="/admin/customers" className="mb-4 flex items-center gap-2">
        <input
          type="search"
          name="q"
          defaultValue={q}
          placeholder="Search name, company, PMB #, or address — active + inactive"
          className="w-full max-w-md rounded-theme border border-border bg-white px-3 py-2 text-sm text-ink outline-none focus:border-accent"
        />
        <button type="submit" className="rounded-theme bg-accent px-3 py-2 text-sm font-medium text-white hover:bg-accentHover">
          Search
        </button>
        {q && (
          <Link href="/admin/customers" className="rounded-theme border border-border px-3 py-2 text-sm text-inkMuted hover:bg-surfaceAlt">
            Clear
          </Link>
        )}
      </form>

      {q && (
        <p className="mb-2 text-sm text-inkMuted">
          {listCount} {listCount === 1 ? "match" : "matches"} for &ldquo;{q}&rdquo; (active + inactive, ranked).
        </p>
      )}

      {/* Table */}
      <div className="overflow-x-auto rounded-theme border border-border">
        <table className="w-full text-sm">
          <thead className="bg-surfaceAlt">
            <tr>
              <th className={th}>Box&nbsp;#</th>
              <th className={th}>Name / Company</th>
              <th className={th}>Email</th>
              <th className={th}>Status</th>
              <th className={th}>Plan</th>
              <th className={thr}>Balance</th>
              <th className={th}>Last activity</th>
              <th className={th}>Joined</th>
            </tr>
          </thead>
          <tbody className="bg-surface">
            {rows.map((r) => {
              const inactive = isInactive(r.status);
              return (
                <tr key={r.id} className={"border-t border-border align-top " + (inactive ? "bg-surfaceAlt/40" : "")}>
                  <td className={"px-3 py-2 whitespace-nowrap font-medium " + (inactive ? "text-inkMuted" : "text-ink")}>
                    {r.box_number ?? "—"}
                  </td>
                  <td className="px-3 py-2">
                    <div className={inactive ? "text-inkMuted" : "text-ink"}>{r.company || r.name || "—"}</div>
                    {r.company && r.name && <div className="text-xs text-inkSubtle">{r.name}</div>}
                  </td>
                  <td className="px-3 py-2 text-inkMuted">{r.email || "—"}</td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    <span className={"rounded-theme px-2 py-0.5 text-xs font-medium " + badgeClass(r.status ?? "")}>
                      {r.status ?? "—"}
                    </span>
                    {inactive && (
                      <span
                        className="ml-1.5 rounded-theme bg-amber-50 px-1.5 py-0.5 text-[11px] font-medium text-amber-700 ring-1 ring-amber-200"
                        title="Mail correct, account not — candidate for win-back."
                      >
                        Win-back
                      </span>
                    )}
                  </td>
                  <td className={"px-3 py-2 " + (inactive ? "text-inkMuted" : "text-ink")}>
                    {r.plan_id ? planName.get(r.plan_id) ?? "Unknown plan" : "—"}
                  </td>
                  <td className={"px-3 py-2 text-right whitespace-nowrap " + (inactive ? "text-inkMuted" : "text-ink")}>
                    {money(r.account_balance)}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap text-inkMuted">{fmtDate(r.last_activity)}</td>
                  <td className="px-3 py-2 whitespace-nowrap text-inkSubtle">{fmtDate(r.created_at)}</td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-10 text-center text-inkSubtle">
                  {q
                    ? <>No customers match &ldquo;{q}&rdquo;. Try a partial name, company, PMB #, or address — the search spans active and inactive accounts.</>
                    : total === 0
                      ? <>No customers yet. Accounts appear here after intake links them, or after the provider migration import (iPostal1 / Opus / PostScan).</>
                      : statusParam === "active"
                        ? <>No active accounts in this view.</>
                        : statusParam === "inactive"
                          ? <>No inactive accounts — every account is currently Active.</>
                          : <>No accounts with status &ldquo;{statusParam}&rdquo;.</>}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination (filtered list only; search returns a single ranked set) */}
      {!q && listCount > 0 && (
        <div className="mt-3 flex items-center justify-between text-sm text-inkMuted">
          <div>
            Showing {rangeStart}–{rangeEnd} of {listCount}
          </div>
          {totalPages > 1 && (
            <div className="flex items-center gap-2">
              {page > 1 ? (
                <Link
                  href={`/admin/customers?${new URLSearchParams({ ...(statusParam !== "all" ? { status: statusParam } : {}), page: String(page - 1) }).toString()}`}
                  className="rounded-theme border border-border px-3 py-1.5 text-inkMuted hover:bg-surfaceAlt"
                >
                  ← Prev
                </Link>
              ) : (
                <span className="rounded-theme border border-border px-3 py-1.5 text-inkSubtle opacity-50">← Prev</span>
              )}
              <span className="text-inkSubtle">Page {page} of {totalPages}</span>
              {page < totalPages ? (
                <Link
                  href={`/admin/customers?${new URLSearchParams({ ...(statusParam !== "all" ? { status: statusParam } : {}), page: String(page + 1) }).toString()}`}
                  className="rounded-theme border border-border px-3 py-1.5 text-inkMuted hover:bg-surfaceAlt"
                >
                  Next →
                </Link>
              ) : (
                <span className="rounded-theme border border-border px-3 py-1.5 text-inkSubtle opacity-50">Next →</span>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
