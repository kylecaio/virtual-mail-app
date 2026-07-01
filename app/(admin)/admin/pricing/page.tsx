import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { workedExamples, type Plan, type PricingRule, type ShippingMargin } from "@/lib/pricing";
import AdminNav from "../AdminNav";
import PlanRow from "./PlanRow";
import RuleRow from "./RuleRow";
import MarginRow from "./MarginRow";

export const dynamic = "force-dynamic";

const th = "px-3 py-2 text-left text-xs font-medium uppercase tracking-wide text-inkSubtle";
const thr = "px-3 py-2 text-right text-xs font-medium uppercase tracking-wide text-inkSubtle";
const money = (n: number) => `$${n.toFixed(2)}`;
const CARRIER_ORDER = ["USPS", "FedEx", "UPS", "DHL"];

export default async function PricingPage() {
  await requireAdmin();
  const supabase = createClient();

  const [{ data: plans }, { data: rules }, { data: margins }] = await Promise.all([
    supabase.from("plans").select("*").order("display_order"),
    supabase.from("pricing_rules").select("*").order("service_type"),
    supabase.from("shipping_margins").select("*").order("carrier").order("service_type"),
  ]);

  const planList = (plans ?? []) as Plan[];
  const ruleList = (rules ?? []) as PricingRule[];
  const marginList = (margins ?? []) as ShippingMargin[];
  const ex = workedExamples(ruleList, marginList);

  const byCarrier = CARRIER_ORDER
    .map((c) => ({ carrier: c, items: marginList.filter((m) => m.carrier === c) }))
    .filter((g) => g.items.length > 0);

  return (
    <div>
      <h1 className="font-serif text-2xl font-semibold text-ink">Pricing editor</h1>
      <p className="mt-1 text-inkMuted">Edit a value and Save. Changes are live immediately — the customer pricing views and billing calculations read the same rows. Every save is written to the audit log.</p>

      <AdminNav />

      {/* Plans */}
      <section className="mb-10">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-inkSubtle">Subscription plans</h2>
        <div className="overflow-x-auto rounded-theme border border-border">
          <table className="w-full text-sm">
            <thead className="bg-surfaceAlt"><tr>
              <th className={th}>Plan</th><th className={thr}>Monthly $</th><th className={thr}>Annual $</th>
              <th className={thr}>Included</th><th className={thr}>Overage $</th><th className={thr}>Free days</th>
              <th className={thr}>Order</th><th className={th + " text-center"}>Active</th><th className={th}></th>
            </tr></thead>
            <tbody className="bg-surface">
              {planList.map((p) => <PlanRow key={p.id} plan={p} />)}
            </tbody>
          </table>
        </div>
      </section>

      {/* Pricing rules */}
      <section className="mb-10">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-inkSubtle">Per-action rates</h2>
        <div className="overflow-x-auto rounded-theme border border-border">
          <table className="w-full text-sm">
            <thead className="bg-surfaceAlt"><tr>
              <th className={th}>Service</th><th className={thr}>Base</th><th className={thr}>Included units</th>
              <th className={thr}>Overage</th><th className={thr}>Min</th><th className={thr}>Max</th>
              <th className={th + " text-center"}>Active</th><th className={th}></th>
            </tr></thead>
            <tbody className="bg-surface">
              {ruleList.map((r) => <RuleRow key={r.id} rule={r} />)}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs text-inkSubtle">Scan/express/shred: base covers the included pages, then overage per extra page. Storage daily/cap and sales tax feed the billing calculations.</p>
      </section>

      {/* Shipping margins */}
      <section className="mb-10">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-inkSubtle">Forwarding carrier margins</h2>
        <p className="mb-3 text-xs text-inkSubtle">Forward total = postage + margin% of postage + carrier handling + the flat forward-handling fee above.</p>
        <div className="space-y-5">
          {byCarrier.map((g) => (
            <div key={g.carrier} className="overflow-x-auto rounded-theme border border-border">
              <table className="w-full text-sm">
                <thead className="bg-surfaceAlt"><tr>
                  <th className={th}>{g.carrier} service</th><th className={thr}>Margin</th><th className={thr}>Handling $</th>
                  <th className={th + " text-center"}>Active</th><th className={th}></th>
                </tr></thead>
                <tbody className="bg-surface">
                  {g.items.map((m) => <MarginRow key={m.id} margin={m} />)}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      </section>

      {/* Worked examples — computed live from the rows above, reconcile to PRICING.md */}
      <section className="mb-4">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-inkSubtle">Worked examples (live)</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-theme border border-border bg-surface p-4">
            <div className="text-sm font-medium text-ink">15-page scan</div>
            <div className="mt-1 text-2xl font-semibold text-ink">{money(ex.scan15)}</div>
            <div className="mt-1 text-xs text-inkSubtle">PRICING.md example: $4.00</div>
          </div>
          <div className="rounded-theme border border-border bg-surface p-4">
            <div className="text-sm font-medium text-ink">Forward — USPS Priority, $8.50 postage</div>
            <div className="mt-1 text-2xl font-semibold text-ink">{ex.fwd ? money(ex.fwd.total) : "—"}</div>
            <div className="mt-1 text-xs text-inkSubtle">PRICING.md example: $14.20</div>
          </div>
          <div className="rounded-theme border border-border bg-surface p-4">
            <div className="text-sm font-medium text-ink">Storage — 45 days, 3 items</div>
            <div className="mt-1 text-2xl font-semibold text-ink">{money(ex.storage)}</div>
            <div className="mt-1 text-xs text-inkSubtle">PRICING.md example: $4.50</div>
          </div>
        </div>
      </section>
    </div>
  );
}
