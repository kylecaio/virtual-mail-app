import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import AdminNav from "../AdminNav";
import BillingAdminRow from "./BillingAdminRow";

export const dynamic = "force-dynamic";

const th = "px-3 py-2 text-left text-xs font-medium uppercase tracking-wide text-inkSubtle";
const thr = "px-3 py-2 text-right text-xs font-medium uppercase tracking-wide text-inkSubtle";

export default async function AdminBillingPage() {
  await requireAdmin();
  const supabase = createClient();

  const { data } = await supabase
    .from("billing_history")
    .select("id, date, amount, type, status, source, description, stripe_payment_intent_id, customer_id, customers(name, box_number)")
    .order("date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(100);

  const rows = (data ?? []).map((r: any) => ({
    ...r,
    customer_name: r.customers ? `#${r.customers.box_number} ${r.customers.name}` : null,
  }));

  return (
    <div>
      <h1 className="font-serif text-2xl font-semibold text-ink">Billing</h1>
      <p className="mt-1 text-inkMuted">Recent transactions across all customers. Refund reverses the charge (card refund via Stripe, or credits the account balance); Waive marks it forgiven. Both are audited and excluded from Reports revenue.</p>

      <AdminNav />

      <div className="overflow-x-auto rounded-theme border border-border">
        <table className="w-full text-sm">
          <thead className="bg-surfaceAlt"><tr>
            <th className={th}>Date</th><th className={th}>Customer</th><th className={th}>Description</th>
            <th className={th}>Type</th><th className={th}>Source</th><th className={th}>Status</th>
            <th className={thr}>Amount</th><th className={th}></th>
          </tr></thead>
          <tbody className="bg-surface">
            {rows.length === 0 ? (
              <tr><td className="px-3 py-6 text-center text-inkSubtle" colSpan={8}>No transactions yet.</td></tr>
            ) : (
              rows.map((r: any) => <BillingAdminRow key={r.id} row={r} />)
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
