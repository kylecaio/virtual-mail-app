import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function StatusPage() {
  const supabase = createClient();
  const { data: plans, error } = await supabase
    .from("plans")
    .select("name, monthly_price, included_items, overage_rate")
    .order("display_order");

  const ok = !error && Array.isArray(plans);

  return (
    <main className="min-h-screen bg-bg">
      <div className="mx-auto max-w-3xl px-6 py-14">
        <a href="/" className="text-sm text-accent hover:text-accentHover">← Home</a>
        <h1 className="mt-4 font-serif text-3xl font-semibold text-ink">System Status</h1>

        <div className="mt-6 flex items-center gap-3 rounded-theme border border-border bg-surface p-4">
          <span className={`h-2.5 w-2.5 rounded-full ${ok ? "bg-emerald-500" : "bg-red-500"}`} />
          <span className="text-sm text-ink">
            Supabase connection: <strong>{ok ? "healthy" : "error"}</strong>
            {error ? ` — ${error.message}` : ""}
          </span>
        </div>

        <h2 className="mt-10 text-sm font-semibold uppercase tracking-wide text-inkSubtle">
          Plans (read live from Postgres via RLS)
        </h2>
        <div className="mt-3 overflow-hidden rounded-theme border border-border">
          <table className="w-full text-sm">
            <thead className="bg-surfaceAlt text-left text-inkMuted">
              <tr>
                <th className="px-4 py-2 font-medium">Plan</th>
                <th className="px-4 py-2 font-medium">Monthly</th>
                <th className="px-4 py-2 font-medium">Included items</th>
                <th className="px-4 py-2 font-medium">Overage</th>
              </tr>
            </thead>
            <tbody className="bg-surface">
              {(plans ?? []).map((p: any) => (
                <tr key={p.name} className="border-t border-border">
                  <td className="px-4 py-2 font-medium text-ink">{p.name}</td>
                  <td className="px-4 py-2 text-inkMuted">${Number(p.monthly_price).toFixed(2)}</td>
                  <td className="px-4 py-2 text-inkMuted">{p.included_items}/mo</td>
                  <td className="px-4 py-2 text-inkMuted">${Number(p.overage_rate).toFixed(2)}/item</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-4 text-xs text-inkSubtle">
          If this table renders four plans, the full Phase-1 stack is live: Next.js → Supabase client → Postgres → RLS “public read” policy on <code>plans</code>.
        </p>
      </div>
    </main>
  );
}
