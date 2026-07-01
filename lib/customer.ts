import { createClient } from "@/lib/supabase/server";

export type CustomerRow = {
  id: string;
  box_number: number;
  name: string;
  company: string | null;
  email: string | null;
  status: string;
  plan_id: string | null;
  forwarding_address: string | null;
};

// The customer account linked to the signed-in user (RLS returns only their own).
// Returns null if no customer is linked yet (e.g. a bare customer login).
export async function getMyCustomer(): Promise<CustomerRow | null> {
  const supabase = createClient();
  const { data } = await supabase
    .from("customers")
    .select("id, box_number, name, company, email, status, plan_id, forwarding_address")
    .order("box_number")
    .limit(1)
    .maybeSingle();
  return (data as CustomerRow) ?? null;
}
