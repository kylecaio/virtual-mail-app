import { createClient } from "@/lib/supabase/server";
import { getMyCustomer } from "@/lib/customer";

// Renders active broadcasts as banners on the customer dashboard.
// Audience filtering: "all" always shows; "active"/"past_due" match the
// customer's account status. RLS (broadcasts_read_active) already limits
// reads to is_active = true.
const STATUS_TO_AUDIENCE: Record<string, string> = { Active: "active", "Past Due": "past_due" };

export default async function BroadcastBanner() {
  const supabase = createClient();
  const customer = await getMyCustomer();

  const audiences = ["all"];
  if (customer && STATUS_TO_AUDIENCE[customer.status]) audiences.push(STATUS_TO_AUDIENCE[customer.status]);

  const { data } = await supabase
    .from("broadcasts")
    .select("id, title, body, audience, is_active, created_at")
    .eq("is_active", true)
    .in("audience", audiences)
    .order("created_at", { ascending: false });

  const list = data ?? [];
  if (list.length === 0) return null;

  return (
    <div className="mb-6 space-y-2">
      {list.map((b: any) => (
        <div key={b.id} className="rounded-theme border border-accent/30 bg-accentSubtle px-4 py-3">
          <div className="text-sm font-semibold text-accent">{b.title}</div>
          <div className="mt-0.5 text-sm text-ink">{b.body}</div>
        </div>
      ))}
    </div>
  );
}
