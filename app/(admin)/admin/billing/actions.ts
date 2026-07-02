"use server";

import { getProfile } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { stripe } from "@/lib/stripe";

export type AdjustResult = { ok: true; status: string } | { ok: false; error: string };

/** Admin refund or waive of a billing_history row. */
export async function adminAdjustBilling(id: string, kind: "refund" | "waive"): Promise<AdjustResult> {
  const profile = await getProfile();
  if (!profile || profile.role !== "admin") return { ok: false, error: "Not authorized" };

  const db = createAdminClient();
  const { data: row } = await db
    .from("billing_history")
    .select("id, customer_id, amount, type, source, status, stripe_payment_intent_id, description")
    .eq("id", id)
    .maybeSingle();
  if (!row) return { ok: false, error: "Transaction not found" };
  if (row.status === "Refunded" || row.status === "Waived") {
    return { ok: false, error: `Already ${row.status.toLowerCase()}` };
  }

  const newStatus = kind === "refund" ? "Refunded" : "Waived";

  try {
    if (kind === "refund") {
      if (row.source === "card" && row.stripe_payment_intent_id) {
        await stripe.refunds.create({ payment_intent: row.stripe_payment_intent_id });
      } else if (row.source === "balance") {
        // Money originally drew down the account balance — put it back.
        await db.rpc("p7_credit_balance", { p_customer: row.customer_id, p_amount: Number(row.amount) });
      }
      // source "credit" ($0) and "invoice": no cash movement here; just mark reversed.
    }
  } catch (err: any) {
    return { ok: false, error: `Stripe refund failed: ${err?.message ?? "unknown"}` };
  }

  await db.from("billing_history").update({ status: newStatus }).eq("id", id);

  // Audit (admin client bypasses RLS; set actor explicitly).
  await db.from("audit_log").insert({
    actor: profile.id,
    action: `billing.${kind}`,
    entity: "billing_history",
    entity_id: id,
    detail: { before: row, new_status: newStatus },
  });

  return { ok: true, status: newStatus };
}
