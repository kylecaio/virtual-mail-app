import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import AdminNav from "../AdminNav";

export const dynamic = "force-dynamic";

const money = (n: number) => `$${n.toFixed(2)}`;
const th = "px-3 py-2 text-left text-xs font-medium uppercase tracking-wide text-inkSubtle";
const thr = "px-3 py-2 text-right text-xs font-medium uppercase tracking-wide text-inkSubtle";

function monthKey(d: string | Date) {
  const dt = new Date(d);
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, "0")}`;
}
function lastMonths(n: number): string[] {
  const out: string[] = [];
  const now = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    out.push(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`);
  }
  return out;
}
function label(mk: string) {
  const [y, m] = mk.split("-");
  return new Date(Date.UTC(Number(y), Number(m) - 1, 1)).toLocaleString("en-US", { month: "short", timeZone: "UTC" }) + " " + y.slice(2);
}

// Lightweight CSS bar chart — no external chart lib.
function BarChart({ months, values, format }: { months: string[]; values: number[]; format: (n: number) => string }) {
  const max = Math.max(1, ...values);
  return (
    <div className="flex items-end gap-1.5" style={{ height: 140 }}>
      {months.map((mk, i) => (
        <div key={mk} className="flex flex-1 flex-col items-center justify-end gap-1">
          <div className="text-[10px] text-inkSubtle">{values[i] ? format(values[i]) : ""}</div>
          <div className="w-full rounded-t bg-accent" style={{ height: `${(values[i] / max) * 100}%`, minHeight: values[i] ? 3 : 0 }} title={`${label(mk)}: ${format(values[i])}`} />
          <div className="text-[10px] text-inkSubtle">{label(mk).split(" ")[0]}</div>
        </div>
      ))}
    </div>
  );
}

export default async function ReportsPage() {
  await requireAdmin();
  const supabase = createClient();

  const [{ data: billing }, { data: pieces }, { data: requests }, { data: customers }, { data: plans }] = await Promise.all([
    supabase.from("billing_history").select("date, amount, type, status").limit(10000),
    supabase.from("mail_pieces").select("received_at, status").limit(10000),
    supabase.from("service_requests").select("type, status, requested_at").limit(10000),
    supabase.from("customers").select("status, plan_id").limit(10000),
    supabase.from("plans").select("id, name").order("display_order"),
  ]);

  const bl = billing ?? [], mp = pieces ?? [], sr = requests ?? [], cu = customers ?? [];
  const planName = new Map((plans ?? []).map((p: any) => [p.id, p.name]));
  const months = lastMonths(12);

  // Revenue by month + net-of-tax
  const revByMonth = Object.fromEntries(months.map((m) => [m, 0]));
  const netByMonth = Object.fromEntries(months.map((m) => [m, 0]));
  const revByType: Record<string, number> = {};
  let grossTotal = 0, taxTotal = 0;
  for (const r of bl as any[]) {
    const amt = Number(r.amount) || 0;
    grossTotal += amt;
    revByType[r.type] = (revByType[r.type] ?? 0) + amt;
    if (r.type === "Tax") taxTotal += amt;
    const mk = monthKey(r.date);
    if (mk in revByMonth) { revByMonth[mk] += amt; if (r.type !== "Tax") netByMonth[mk] += amt; }
  }
  const netTotal = grossTotal - taxTotal;

  // Pieces by month + by current status
  const piecesByMonth = Object.fromEntries(months.map((m) => [m, 0]));
  const piecesByStatus: Record<string, number> = {};
  for (const p of mp as any[]) {
    const mk = monthKey(p.received_at);
    if (mk in piecesByMonth) piecesByMonth[mk] += 1;
    piecesByStatus[p.status] = (piecesByStatus[p.status] ?? 0) + 1;
  }

  // Requests by type + open/completed
  const reqByType: Record<string, number> = {};
  let reqOpen = 0, reqDone = 0;
  for (const r of sr as any[]) {
    reqByType[r.type] = (reqByType[r.type] ?? 0) + 1;
    if (r.status === "Open") reqOpen++; else if (r.status === "Completed") reqDone++;
  }

  // Subscriptions: customers by plan + by status
  const custByPlan: Record<string, number> = {};
  const custByStatus: Record<string, number> = {};
  for (const c of cu as any[]) {
    const pn = c.plan_id ? (planName.get(c.plan_id) ?? "Unknown plan") : "No plan";
    custByPlan[pn] = (custByPlan[pn] ?? 0) + 1;
    custByStatus[c.status] = (custByStatus[c.status] ?? 0) + 1;
  }

  const card = "rounded-theme border border-border bg-surface p-4";
  const entries = (o: Record<string, number>) => Object.entries(o).sort((a, b) => b[1] - a[1]);

  return (
    <div>
      <h1 className="font-serif text-2xl font-semibold text-ink">Reports</h1>
      <p className="mt-1 text-inkMuted">Aggregates over live data. Admins see all rows.</p>

      <AdminNav />

      {/* KPI row */}
      <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <div className={card}><div className="text-2xl font-semibold text-ink">{money(grossTotal)}</div><div className="text-xs text-inkMuted">Gross billed</div></div>
        <div className={card}><div className="text-2xl font-semibold text-ink">{money(netTotal)}</div><div className="text-xs text-inkMuted">Net of tax</div></div>
        <div className={card}><div className="text-2xl font-semibold text-ink">{money(taxTotal)}</div><div className="text-xs text-inkMuted">Tax collected</div></div>
        <div className={card}><div className="text-2xl font-semibold text-ink">{mp.length}</div><div className="text-xs text-inkMuted">Pieces</div></div>
        <div className={card}><div className="text-2xl font-semibold text-ink">{reqOpen}<span className="text-sm text-inkSubtle">/{reqOpen + reqDone}</span></div><div className="text-xs text-inkMuted">Open requests</div></div>
        <div className={card}><div className="text-2xl font-semibold text-ink">{cu.length}</div><div className="text-xs text-inkMuted">Customers</div></div>
      </div>

      {/* Charts */}
      <div className="mb-8 grid gap-4 lg:grid-cols-2">
        <div className={card}>
          <div className="mb-3 text-sm font-semibold text-ink">Revenue — last 12 months</div>
          <BarChart months={months} values={months.map((m) => revByMonth[m])} format={money} />
        </div>
        <div className={card}>
          <div className="mb-3 text-sm font-semibold text-ink">Pieces received — last 12 months</div>
          <BarChart months={months} values={months.map((m) => piecesByMonth[m])} format={(n) => String(n)} />
        </div>
      </div>

      {/* Tables */}
      <div className="grid gap-4 lg:grid-cols-2">
        <div>
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-inkSubtle">Revenue by category</h2>
          <div className="overflow-hidden rounded-theme border border-border">
            <table className="w-full text-sm"><thead className="bg-surfaceAlt"><tr><th className={th}>Type</th><th className={thr}>Amount</th></tr></thead>
              <tbody className="bg-surface">
                {entries(revByType).map(([k, v]) => <tr key={k} className="border-t border-border"><td className="px-3 py-2 text-ink">{k}</td><td className="px-3 py-2 text-right text-ink">{money(v)}</td></tr>)}
                {entries(revByType).length === 0 && <tr><td colSpan={2} className="px-3 py-6 text-center text-inkSubtle">No billing yet.</td></tr>}
              </tbody></table>
          </div>
        </div>

        <div>
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-inkSubtle">Service requests by type</h2>
          <div className="overflow-hidden rounded-theme border border-border">
            <table className="w-full text-sm"><thead className="bg-surfaceAlt"><tr><th className={th}>Type</th><th className={thr}>Count</th></tr></thead>
              <tbody className="bg-surface">
                {entries(reqByType).map(([k, v]) => <tr key={k} className="border-t border-border"><td className="px-3 py-2 text-ink">{k}</td><td className="px-3 py-2 text-right text-ink">{v}</td></tr>)}
                {entries(reqByType).length === 0 && <tr><td colSpan={2} className="px-3 py-6 text-center text-inkSubtle">No requests yet.</td></tr>}
              </tbody></table>
          </div>
        </div>

        <div>
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-inkSubtle">Subscriptions by plan</h2>
          <div className="overflow-hidden rounded-theme border border-border">
            <table className="w-full text-sm"><thead className="bg-surfaceAlt"><tr><th className={th}>Plan</th><th className={thr}>Customers</th></tr></thead>
              <tbody className="bg-surface">
                {entries(custByPlan).map(([k, v]) => <tr key={k} className="border-t border-border"><td className="px-3 py-2 text-ink">{k}</td><td className="px-3 py-2 text-right text-ink">{v}</td></tr>)}
                {entries(custByPlan).length === 0 && <tr><td colSpan={2} className="px-3 py-6 text-center text-inkSubtle">No customers yet.</td></tr>}
              </tbody></table>
          </div>
        </div>

        <div>
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-inkSubtle">Customers by status</h2>
          <div className="overflow-hidden rounded-theme border border-border">
            <table className="w-full text-sm"><thead className="bg-surfaceAlt"><tr><th className={th}>Status</th><th className={thr}>Count</th></tr></thead>
              <tbody className="bg-surface">
                {entries(custByStatus).map(([k, v]) => <tr key={k} className="border-t border-border"><td className="px-3 py-2 text-ink">{k}</td><td className="px-3 py-2 text-right text-ink">{v}</td></tr>)}
                {entries(custByStatus).length === 0 && <tr><td colSpan={2} className="px-3 py-6 text-center text-inkSubtle">No customers yet.</td></tr>}
              </tbody></table>
          </div>
        </div>
      </div>

      <p className="mt-4 text-xs text-inkSubtle">Net of tax excludes the 9.25% sales-tax line. Forwarding postage is billed largely pass-through, so gross includes carrier cost; a true margin split arrives with Stripe billing detail (Phase 7).</p>
    </div>
  );
}
