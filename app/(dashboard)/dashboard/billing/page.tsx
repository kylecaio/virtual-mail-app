import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import DashboardNav from "../DashboardNav";
import NoMailbox from "../NoMailbox";
import { SubscribeButton, BuyPackButton, ManageBillingButton } from "./BillingActions";

export const dynamic = "force-dynamic";

const money = (n: number) => `$${Number(n).toFixed(2)}`;
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const prettyService = (s: string) => cap(s.replace(/_/g, " "));

function subLabel(status: string | null): { text: string; tone: string } {
  switch (status) {
    case "active":
    case "trialing":
      return { text: "Active", tone: "text-green-700 bg-green-50 border-green-200" };
    case "past_due":
    case "unpaid":
      return { text: "Past due", tone: "text-amber-700 bg-amber-50 border-amber-200" };
    case "canceled":
      return { text: "Canceled", tone: "text-inkMuted bg-surfaceAlt border-border" };
    default:
      return { text: "No subscription", tone: "text-inkMuted bg-surfaceAlt border-border" };
  }
}

export default async function BillingPage({
  searchParams,
}: {
  searchParams: { checkout?: string };
}) {
  const profile = await requireUser();
  const supabase = createClient();

  const { data: customer } = await supabase
    .from("customers")
    .select(
      "id, name, plan_id, account_balance, subscription_status, current_period_end, stripe_customer_id, status"
    )
    .order("box_number")
    .limit(1)
    .maybeSingle();

  if (!customer) {
    return (
      <div>
        <h1 className="mb-6 font-serif text-2xl font-semibold text-ink">Billing</h1>
        <DashboardNav />
        <NoMailbox email={profile.email} />
      </div>
    );
  }

  const [{ data: currentPlan }, { data: plans }, { data: packages }, { data: credits }, { data: history }] =
    await Promise.all([
      customer.plan_id
        ? supabase.from("plans").select("name, monthly_price, included_items").eq("id", customer.plan_id).maybeSingle()
        : Promise.resolve({ data: null } as any),
      supabase
        .from("plans")
        .select("id, name, monthly_price, included_items, stripe_price_id")
        .eq("is_active", true)
        .order("display_order"),
      supabase
        .from("packages")
        .select("id, name, service_type, quantity, bonus, price, stripe_price_id")
        .eq("is_active", true)
        .order("display_order"),
      supabase
        .from("service_credit_balances")
        .select("service_type, remaining")
        .eq("customer_id", customer.id)
        .gt("remaining", 0)
        .order("service_type"),
      supabase
        .from("billing_history")
        .select("date, amount, type, status, description, source")
        .eq("customer_id", customer.id)
        .order("date", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(30),
    ]);

  const sub = subLabel(customer.subscription_status);
  const isActive = customer.subscription_status === "active" || customer.subscription_status === "trialing";
  const renewal = customer.current_period_end
    ? new Date(customer.current_period_end).toLocaleDateString()
    : null;
  const pending = (history ?? []).filter((h: any) => h.status === "Pending");
  const th = "px-3 py-2 text-left text-xs font-medium uppercase tracking-wide text-inkSubtle";
  const thr = "px-3 py-2 text-right text-xs font-medium uppercase tracking-wide text-inkSubtle";

  return (
    <div>
      <h1 className="mb-6 font-serif text-2xl font-semibold text-ink">Billing</h1>
      <DashboardNav />

      {searchParams.checkout === "success" ? (
        <div className="mb-5 rounded-theme border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
          Payment received — this page updates within a few seconds as Stripe confirms.
        </div>
      ) : searchParams.checkout === "cancel" ? (
        <div className="mb-5 rounded-theme border border-border bg-surfaceAlt px-4 py-3 text-sm text-inkMuted">
          Checkout canceled — nothing was charged.
        </div>
      ) : null}

      <div className="space-y-8">
        {/* Subscription */}
        <section className="rounded-theme border border-border bg-surface p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-inkSubtle">Subscription</h2>
            <span className={"rounded-full border px-2 py-0.5 text-xs font-medium " + sub.tone}>{sub.text}</span>
          </div>

          {isActive ? (
            <div className="mt-3 flex flex-wrap items-center justify-between gap-4">
              <div className="text-sm text-ink">
                <div className="font-medium">{(currentPlan as any)?.name ?? "Plan"}</div>
                <div className="text-inkMuted">
                  {(currentPlan as any) ? money((currentPlan as any).monthly_price) + "/mo" : ""}
                  {renewal ? ` · renews ${renewal}` : ""}
                </div>
                <div className="mt-1 text-xs text-inkSubtle">
                  Mail service begins once your USPS Form 1583 is approved.
                </div>
              </div>
              <ManageBillingButton />
            </div>
          ) : (
            <div className="mt-4">
              <p className="mb-3 text-sm text-inkMuted">Choose a plan to activate billing. (Mail is received once Form 1583 is approved.)</p>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {(plans ?? []).map((p: any) => (
                  <div key={p.id} className="flex flex-col rounded-theme border border-border p-4">
                    <div className="text-sm font-medium text-ink">{p.name}</div>
                    <div className="mt-1 text-2xl font-semibold text-ink">{money(p.monthly_price)}<span className="text-sm font-normal text-inkSubtle">/mo</span></div>
                    <div className="mt-1 mb-3 text-xs text-inkSubtle">{p.included_items} items included</div>
                    <div className="mt-auto">
                      {p.stripe_price_id ? (
                        <SubscribeButton planId={p.id} label="Subscribe" />
                      ) : (
                        <span className="text-xs text-inkSubtle">Not available yet</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>

        {/* Balance + credits */}
        <section className="rounded-theme border border-border bg-surface p-5">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-inkSubtle">Balance &amp; credits</h2>
          <div className="mt-3 flex flex-wrap items-center gap-6">
            <div>
              <div className="text-xs text-inkSubtle">Account balance</div>
              <div className="text-2xl font-semibold text-ink">{money(customer.account_balance)}</div>
            </div>
            <div className="min-w-[12rem]">
              <div className="text-xs text-inkSubtle">Action credits</div>
              {(credits ?? []).length === 0 ? (
                <div className="text-sm text-inkMuted">None — buy a pack below.</div>
              ) : (
                <ul className="mt-1 flex flex-wrap gap-2">
                  {(credits ?? []).map((c: any) => (
                    <li key={c.service_type} className="rounded-full border border-border bg-surfaceAlt px-2.5 py-0.5 text-xs text-ink">
                      {c.remaining} × {prettyService(c.service_type)}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
          <p className="mt-3 text-xs text-inkSubtle">
            At fulfilment we use a matching action credit first, then your balance, then your saved card.
          </p>
        </section>

        {/* Buy packs */}
        <section className="rounded-theme border border-border bg-surface p-5">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-inkSubtle">Buy credit packs</h2>
          {(packages ?? []).length === 0 ? (
            <p className="text-sm text-inkMuted">No packs available right now.</p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {(packages ?? []).map((p: any) => (
                <div key={p.id} className="flex items-center justify-between rounded-theme border border-border p-4">
                  <div>
                    <div className="text-sm font-medium text-ink">{p.name}</div>
                    <div className="text-xs text-inkSubtle">
                      {p.quantity}{p.bonus ? ` +${p.bonus} bonus` : ""} × {prettyService(p.service_type)} · {money(p.price)}
                    </div>
                  </div>
                  {p.stripe_price_id ? <BuyPackButton packageId={p.id} /> : <span className="text-xs text-inkSubtle">Soon</span>}
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Outstanding */}
        {pending.length > 0 ? (
          <section className="rounded-theme border border-amber-200 bg-amber-50 p-5">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-amber-800">Outstanding</h2>
            <ul className="mt-2 space-y-1 text-sm text-amber-900">
              {pending.map((h: any, i: number) => (
                <li key={i}>{h.description || h.type} — {money(h.amount)} (pending)</li>
              ))}
            </ul>
          </section>
        ) : null}

        {/* History */}
        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-inkSubtle">Payment history</h2>
          <div className="overflow-x-auto rounded-theme border border-border">
            <table className="w-full text-sm">
              <thead className="bg-surfaceAlt"><tr>
                <th className={th}>Date</th><th className={th}>Description</th><th className={th}>Type</th>
                <th className={th}>Source</th><th className={th}>Status</th><th className={thr}>Amount</th>
              </tr></thead>
              <tbody className="bg-surface">
                {(history ?? []).length === 0 ? (
                  <tr><td className="px-3 py-4 text-inkMuted" colSpan={6}>No transactions yet.</td></tr>
                ) : (
                  (history ?? []).map((h: any, i: number) => (
                    <tr key={i} className="border-t border-border">
                      <td className="px-3 py-2 text-inkMuted">{new Date(h.date).toLocaleDateString()}</td>
                      <td className="px-3 py-2 text-ink">{h.description || "—"}</td>
                      <td className="px-3 py-2 text-inkMuted">{h.type}</td>
                      <td className="px-3 py-2 text-inkMuted">{h.source || "—"}</td>
                      <td className="px-3 py-2 text-inkMuted">{h.status}</td>
                      <td className="px-3 py-2 text-right font-medium text-ink">{money(h.amount)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}
