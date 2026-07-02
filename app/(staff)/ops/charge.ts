"use server";

import { getProfile } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  perActionFee,
  forwardCost,
  salesTaxRate,
  creditKeyForAction,
  round2,
  type BillableAction,
  type PricingRule,
  type Plan,
  type ShippingMargin,
} from "@/lib/pricing";
import { chargeOffSession, toCents } from "@/lib/stripe";
import { notify } from "@/lib/email";
import { mailboxEmail, type MailboxEvent } from "@/lib/email-templates";

// Phase 8b — action → customer-notification event.
const EVENT_MAP: Record<BillableAction, MailboxEvent> = {
  Scan: "scanned",
  Forward: "forwarded",
  Shred: "shredded",
  Recycle: "recycled",
  Pickup: "picked_up",
  Consolidate: "forwarded",
};

const STATUS_MAP: Record<BillableAction, string> = {
  Scan: "Scanned",
  Forward: "Forwarded",
  Shred: "Shredded",
  Recycle: "Recycled",
  Pickup: "Picked Up",
  Consolidate: "Forwarded",
};

export type ChargeInput = {
  pieceId: string;
  action: BillableAction;
  pages?: number;
  express?: boolean;
  postage?: number; // Forward only
  carrier?: string; // Forward margin (optional)
  service?: string; // Forward margin (optional)
  tracking?: string; // Forward only
};

export type ChargeResult =
  | { ok: true; outcome: "free" | "credit" | "balance" | "card"; fee: number; tax: number; total: number }
  | { ok: false; error: string; declined?: boolean };

export async function chargeAndFulfil(input: ChargeInput): Promise<ChargeResult> {
  // Staff-only. (No redirect: this is an action returning a result to the client.)
  const profile = await getProfile();
  if (!profile || (profile.role !== "staff" && profile.role !== "admin")) {
    return { ok: false, error: "Not authorized" };
  }

  const db = createAdminClient();

  const { data: piece } = await db
    .from("mail_pieces")
    .select("id, serial, customer_id, status, sender")
    .eq("id", input.pieceId)
    .maybeSingle();
  if (!piece) return { ok: false, error: "Mail piece not found" };

  // Load customer + plan + pricing in parallel.
  const [{ data: customer }, { data: rules }, { data: margins }] = await Promise.all([
    piece.customer_id
      ? db
          .from("customers")
          .select("id, plan_id, account_balance, stripe_customer_id, default_payment_method, email, name")
          .eq("id", piece.customer_id)
          .maybeSingle()
      : Promise.resolve({ data: null } as any),
    db.from("pricing_rules").select("*"),
    db.from("shipping_margins").select("*"),
  ]);

  const ruleList = (rules ?? []) as PricingRule[];
  const marginList = (margins ?? []) as ShippingMargin[];
  let plan: Plan | null = null;
  if (customer?.plan_id) {
    const { data } = await db.from("plans").select("*").eq("id", customer.plan_id).maybeSingle();
    plan = (data as Plan) ?? null;
  }

  // --- Compute pre-tax fee ---
  let fee = 0;
  if (input.action === "Forward") {
    const margin =
      marginList.find(
        (m) => m.is_active && (!input.carrier || m.carrier === input.carrier) && (!input.service || m.service_type === input.service)
      ) ??
      marginList.find((m) => m.is_active && m.carrier === "USPS" && m.service_type === "Priority Mail") ??
      marginList.find((m) => m.is_active);
    const postage = Number(input.postage ?? 0);
    if (margin) {
      fee = forwardCost(ruleList, margin, postage).total;
    } else {
      const fh = Number(ruleList.find((r) => r.service_type === "forward_handling")?.base_amount ?? 0);
      fee = round2(postage + fh);
    }
  } else {
    fee = perActionFee(ruleList, plan, input.action, { pages: input.pages, express: input.express });
  }

  const taxRate = salesTaxRate(ruleList);
  const tax = round2(fee * taxRate);
  const total = round2(fee + tax);

  const now = new Date().toISOString();
  const targetStatus = STATUS_MAP[input.action];

  // --- Charge (unless free) ---
  let outcome: "free" | "credit" | "balance" | "card" = "free";
  let paymentIntentId: string | null = null;

  if (fee > 0 && customer) {
    const creditKey = creditKeyForAction(input.action, input.express);

    // 1) matching action credit
    let consumed = false;
    if (creditKey) {
      const { data } = await db.rpc("p7_consume_credit", {
        p_customer: customer.id,
        p_service_type: creditKey,
      });
      consumed = data === true;
    }

    if (consumed) {
      outcome = "credit";
    } else {
      // 2) dollar account balance
      const { data: debited } = await db.rpc("p7_debit_balance", {
        p_customer: customer.id,
        p_amount: total,
      });
      if (debited === true) {
        outcome = "balance";
      } else {
        // 3) saved card, off-session. Block on decline (no status flip).
        if (!customer.stripe_customer_id || !customer.default_payment_method) {
          return { ok: false, error: "No saved card on file — cannot charge.", declined: true };
        }
        try {
          const pi = await chargeOffSession({
            stripeCustomerId: customer.stripe_customer_id,
            paymentMethodId: customer.default_payment_method,
            amountCents: toCents(total),
            description: `${input.action} — mail #${piece.serial}`,
            metadata: { kind: "per_action", mail_piece_id: piece.id, action: input.action },
          });
          if (pi.status !== "succeeded") {
            return { ok: false, error: `Card ${pi.status.replace(/_/g, " ")} — action not completed.`, declined: true };
          }
          outcome = "card";
          paymentIntentId = pi.id;
        } catch (err: any) {
          const msg = err?.message || "Card declined";
          return { ok: false, error: `Card declined — ${msg}. Action not completed.`, declined: true };
        }
      }
    }

    // --- Record billing_history for the successful charge ---
    if (outcome === "credit") {
      await db.from("billing_history").insert({
        customer_id: customer.id,
        mail_piece_id: piece.id,
        amount: 0,
        type: "Service Fee",
        status: "Paid",
        source: "credit",
        description: `${input.action} — paid with credit`,
      });
    } else {
      const source = outcome; // "balance" | "card"
      const rows: Record<string, unknown>[] = [
        {
          customer_id: customer.id,
          mail_piece_id: piece.id,
          amount: fee,
          type: "Service Fee",
          status: "Paid",
          source,
          description: `${input.action} — mail #${piece.serial}`,
          stripe_payment_intent_id: paymentIntentId,
        },
      ];
      if (tax > 0) {
        rows.push({
          customer_id: customer.id,
          mail_piece_id: piece.id,
          amount: tax,
          type: "Tax",
          status: "Paid",
          source,
          description: `Sales tax — ${input.action}`,
          stripe_payment_intent_id: paymentIntentId,
        });
      }
      await db.from("billing_history").insert(rows);
    }
  }

  // --- Flip mail status ---
  const update: Record<string, unknown> = { status: targetStatus, request: input.action, completed_at: now };
  if (piece.status === "Received") update.requested_at = now; // staff-initiated
  if (input.action === "Forward" && input.tracking) update.tracking = input.tracking;
  await db.from("mail_pieces").update(update).eq("id", piece.id);

  // --- Close the customer's open request (folds in the Phase-5 follow-up); else log a completed one ---
  const { data: openReqs } = await db
    .from("service_requests")
    .update({
      status: "Completed",
      completed_at: now,
      processed_by: profile.id,
      tracking: input.action === "Forward" && input.tracking ? input.tracking : null,
    })
    .eq("mail_piece_id", piece.id)
    .eq("status", "Open")
    .select("id");

  if (!openReqs || openReqs.length === 0) {
    await db.from("service_requests").insert({
      mail_piece_id: piece.id,
      serial: piece.serial,
      customer_id: piece.customer_id ?? null,
      type: input.action,
      status: "Completed",
      completed_at: now,
      processed_by: profile.id,
      tracking: input.action === "Forward" && input.tracking ? input.tracking : null,
    });
  }

  // --- Best-effort customer notification (Phase 8b). Never blocks fulfilment. ---
  if (customer?.email) {
    const event = EVENT_MAP[input.action];
    const base = process.env.NEXT_PUBLIC_SITE_URL ?? "https://big-oakland-mail.vercel.app";
    const tpl = mailboxEmail(event, {
      name: customer.name,
      serial: piece.serial,
      sender: piece.sender,
      portalUrl: `${base}/dashboard`,
      tracking: input.action === "Forward" ? input.tracking : undefined,
    });
    await notify({
      to: customer.email,
      dedupeKey: `${event}:${piece.id}`,
      event,
      subject: tpl.subject,
      html: tpl.html,
      text: tpl.text,
      customerId: customer.id,
    });
  }

  return { ok: true, outcome, fee, tax, total };
}
