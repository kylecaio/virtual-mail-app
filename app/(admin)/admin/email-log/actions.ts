"use server";

// Phase 8e — admin resend of a logged email. Replays the stored subject/body to the
// original recipient with a fresh dedupe key. Admin override: sends regardless of the
// customer's preference (the original unsubscribe footer, if any, is in the stored body).

import { getProfile } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { notify } from "@/lib/email";

export async function resendEmail(id: number): Promise<{ ok: boolean; error?: string }> {
  const profile = await getProfile();
  if (!profile || profile.role !== "admin") return { ok: false, error: "Not authorized" };

  const admin = createAdminClient();
  const { data } = await admin
    .from("email_log")
    .select("recipient, event, subject, body_html, customer_id")
    .eq("id", id)
    .maybeSingle();

  const row = data as
    | { recipient: string; event: string; subject: string | null; body_html: string | null; customer_id: string | null }
    | null;
  if (!row) return { ok: false, error: "Log entry not found" };
  if (!row.subject || !row.body_html) return { ok: false, error: "No stored content to resend (sent before 8e)" };

  const res = await notify({
    to: row.recipient,
    dedupeKey: `resend:${id}:${Date.now()}`,
    event: row.event,
    subject: row.subject,
    html: row.body_html,
    customerId: row.customer_id,
    // no pref → admin override, always sends
  });
  if (res.ok) return { ok: true };
  return { ok: false, error: "error" in res ? res.error : "reason" in res ? res.reason : "failed" };
}
