"use server";

// Phase 8d — token-based preference update for email unsubscribe links (no login).
// The unsubscribe_token acts as the bearer secret; we update only the customer row
// that matches it, via the service-role client.

import { createAdminClient } from "@/lib/supabase/admin";

export type UnsubPrefs = { mail: boolean; requests: boolean; billing: boolean; marketing: boolean };

export async function updatePrefsByToken(
  token: string,
  prefs: UnsubPrefs
): Promise<{ ok: boolean; error?: string }> {
  if (!token) return { ok: false, error: "Missing token" };
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("customers")
    .update({
      notify_mail: prefs.mail,
      notify_requests: prefs.requests,
      notify_billing: prefs.billing,
      notify_marketing: prefs.marketing,
      updated_at: new Date().toISOString(),
    })
    .eq("unsubscribe_token", token)
    .select("id");
  if (error) return { ok: false, error: error.message };
  if (!data || data.length === 0) return { ok: false, error: "This link is invalid or expired." };
  return { ok: true };
}
