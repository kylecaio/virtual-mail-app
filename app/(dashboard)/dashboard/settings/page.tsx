import { requireUser } from "@/lib/auth";
import { getMyCustomer } from "@/lib/customer";
import { createClient } from "@/lib/supabase/server";
import DashboardNav from "../DashboardNav";
import NoMailbox from "../NoMailbox";
import SettingsForm from "./SettingsForm";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const profile = await requireUser();
  const customer = await getMyCustomer();

  const supabase = createClient();
  let plan: { name: string; monthly_price: number; included_items: number } | null = null;
  if (customer?.plan_id) {
    const { data } = await supabase
      .from("plans")
      .select("name, monthly_price, included_items")
      .eq("id", customer.plan_id)
      .maybeSingle();
    plan = (data as any) ?? null;
  }

  return (
    <div>
      <h1 className="mb-6 font-serif text-2xl font-semibold text-ink">Settings</h1>
      <DashboardNav />

      {!customer ? (
        <NoMailbox email={profile.email} />
      ) : (
        <div className="space-y-8">
          {/* Mailbox summary (read-only) */}
          <section className="rounded-theme border border-border bg-surface p-5">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-inkSubtle">Mailbox</h2>
            <dl className="mt-3 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
              <div><dt className="text-inkSubtle">Box</dt><dd className="font-medium text-ink">#{customer.box_number}</dd></div>
              <div><dt className="text-inkSubtle">Status</dt><dd className="font-medium text-ink">{customer.status}</dd></div>
              <div><dt className="text-inkSubtle">Plan</dt><dd className="font-medium text-ink">{plan ? plan.name : "—"}</dd></div>
              <div>
                <dt className="text-inkSubtle">Monthly</dt>
                <dd className="font-medium text-ink">{plan ? `$${Number(plan.monthly_price).toFixed(2)}` : "—"}</dd>
              </div>
            </dl>
            {plan ? (
              <p className="mt-2 text-xs text-inkSubtle">Includes {plan.included_items} items/month. To change plans, contact BIG Oakland.</p>
            ) : null}
          </section>

          <SettingsForm
            userId={profile.id}
            email={customer.email ?? profile.email}
            fullName={profile.full_name}
            forwarding={customer.forwarding_address}
          />
        </div>
      )}
    </div>
  );
}
