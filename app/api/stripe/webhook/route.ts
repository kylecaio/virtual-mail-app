import { NextRequest, NextResponse } from "next/server";
import type Stripe from "stripe";
import type { SupabaseClient } from "@supabase/supabase-js";
import { stripe } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";

// Stripe needs the raw request body + Node runtime for signature verification.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export async function POST(req: NextRequest) {
  const sig = req.headers.get("stripe-signature");
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!sig || !secret) {
    return NextResponse.json({ error: "missing signature or secret" }, { status: 400 });
  }

  const raw = await req.text();
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(raw, sig, secret);
  } catch {
    return NextResponse.json({ error: "invalid signature" }, { status: 400 });
  }

  const db = createAdminClient();

  // Idempotency: first insert of this event id wins; a duplicate delivery is a no-op.
  const { error: dupErr } = await db
    .from("stripe_events")
    .insert({ event_id: event.id, type: event.type });
  if (dupErr) {
    return NextResponse.json({ received: true, duplicate: true });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed":
        await onCheckoutCompleted(db, event.data.object as Stripe.Checkout.Session);
        break;
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted":
        await onSubscriptionChange(db, event.data.object as Stripe.Subscription);
        break;
      case "invoice.paid":
        await onInvoicePaid(db, event.data.object as Stripe.Invoice);
        break;
      case "invoice.payment_failed":
        await onInvoiceFailed(db, event.data.object as Stripe.Invoice);
        break;
      case "charge.refunded":
        await onChargeRefunded(db, event.data.object as Stripe.Charge);
        break;
      // Per-action PaymentIntents are recorded synchronously by the fulfilment action;
      // nothing to do here beyond the idempotency record.
      case "payment_intent.succeeded":
      case "payment_intent.payment_failed":
        break;
      default:
        break;
    }
  } catch (err) {
    // Let Stripe retry: drop the idempotency marker so the retry reprocesses cleanly.
    await db.from("stripe_events").delete().eq("event_id", event.id);
    console.error("stripe webhook handler error", event.type, err);
    return NextResponse.json({ error: "handler error" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}

// --- helpers -------------------------------------------------------------

const asId = (v: string | { id: string } | null | undefined): string | null =>
  typeof v === "string" ? v : v?.id ?? null;

/** Resolve our customers.id — prefer the session client_reference_id, else map by stripe_customer_id. */
async function resolveCustomerId(
  db: SupabaseClient,
  opts: { clientReferenceId?: string | null; stripeCustomerId?: string | null }
): Promise<string | null> {
  if (opts.clientReferenceId) return opts.clientReferenceId;
  if (opts.stripeCustomerId) {
    const { data } = await db
      .from("customers")
      .select("id")
      .eq("stripe_customer_id", opts.stripeCustomerId)
      .maybeSingle();
    return (data as { id: string } | null)?.id ?? null;
  }
  return null;
}

async function onCheckoutCompleted(db: SupabaseClient, session: Stripe.Checkout.Session) {
  const stripeCustomerId = asId(session.customer);
  const customerId = await resolveCustomerId(db, {
    clientReferenceId: session.client_reference_id,
    stripeCustomerId,
  });
  if (!customerId) return;

  if (session.mode === "subscription") {
    const subId = asId(session.subscription);
    let status: string | null = "active";
    let periodEnd: string | null = null;
    let defaultPm: string | null = null;
    if (subId) {
      const sub = await stripe.subscriptions.retrieve(subId);
      status = sub.status;
      periodEnd = new Date(sub.current_period_end * 1000).toISOString();
      defaultPm = asId(sub.default_payment_method);
    }
    await db
      .from("customers")
      .update({
        stripe_customer_id: stripeCustomerId,
        stripe_subscription_id: subId,
        subscription_status: status,
        current_period_end: periodEnd,
        default_payment_method: defaultPm,
      })
      .eq("id", customerId);
    return;
  }

  if (session.mode === "payment") {
    // Prepaid pack purchase. Grant credits + record revenue at purchase.
    const packageId = session.metadata?.package_id;
    if (!packageId) return;
    const { data: pkg } = await db
      .from("packages")
      .select("name, service_type, quantity, bonus, price")
      .eq("id", packageId)
      .maybeSingle();
    if (!pkg) return;

    const grant = Number(pkg.quantity) + Number(pkg.bonus ?? 0);
    await db.rpc("p7_grant_credits", {
      p_customer: customerId,
      p_service_type: pkg.service_type,
      p_qty: grant,
    });

    const pi = asId(session.payment_intent);
    const taxDollars = round2((session.total_details?.amount_tax ?? 0) / 100);
    const rows: Record<string, unknown>[] = [
      {
        customer_id: customerId,
        amount: Number(pkg.price),
        type: "Service Fee",
        status: "Paid",
        source: "card",
        description: `Pack purchased: ${pkg.name} (${grant} × ${pkg.service_type})`,
        stripe_payment_intent_id: pi,
      },
    ];
    if (taxDollars > 0) {
      rows.push({
        customer_id: customerId,
        amount: taxDollars,
        type: "Tax",
        status: "Paid",
        source: "card",
        description: `Sales tax — ${pkg.name}`,
        stripe_payment_intent_id: pi,
      });
    }
    await db.from("billing_history").insert(rows);

    // Keep the card on file as the default for off-session per-action charges.
    if (pi) {
      const intent = await stripe.paymentIntents.retrieve(pi);
      const pm = asId(intent.payment_method);
      if (pm) {
        await db
          .from("customers")
          .update({ stripe_customer_id: stripeCustomerId, default_payment_method: pm })
          .eq("id", customerId);
      }
    }
  }
}

async function onSubscriptionChange(db: SupabaseClient, sub: Stripe.Subscription) {
  const stripeCustomerId = asId(sub.customer);
  const customerId = await resolveCustomerId(db, { stripeCustomerId });
  if (!customerId) return;
  await db
    .from("customers")
    .update({
      stripe_customer_id: stripeCustomerId,
      stripe_subscription_id: sub.id,
      subscription_status: sub.status,
      current_period_end: new Date(sub.current_period_end * 1000).toISOString(),
      default_payment_method: asId(sub.default_payment_method),
    })
    .eq("id", customerId);
}

async function onInvoicePaid(db: SupabaseClient, invoice: Stripe.Invoice) {
  const subId = asId(invoice.subscription);
  if (!subId) return; // only subscription invoices produce recurring revenue here
  const stripeCustomerId = asId(invoice.customer);
  const customerId = await resolveCustomerId(db, { stripeCustomerId });
  if (!customerId) return;

  const taxDollars = round2((invoice.tax ?? 0) / 100);
  const netDollars = round2((invoice.total - (invoice.tax ?? 0)) / 100);
  const rows: Record<string, unknown>[] = [
    {
      customer_id: customerId,
      amount: netDollars,
      type: "Subscription",
      status: "Paid",
      source: "invoice",
      description: "Monthly subscription",
      stripe_invoice_id: invoice.id,
    },
  ];
  if (taxDollars > 0) {
    rows.push({
      customer_id: customerId,
      amount: taxDollars,
      type: "Tax",
      status: "Paid",
      source: "invoice",
      description: "Sales tax — subscription",
      stripe_invoice_id: invoice.id,
    });
  }
  await db.from("billing_history").insert(rows);
  await db
    .from("customers")
    .update({ subscription_status: "active" })
    .eq("id", customerId);
}

async function onInvoiceFailed(db: SupabaseClient, invoice: Stripe.Invoice) {
  const stripeCustomerId = asId(invoice.customer);
  const customerId = await resolveCustomerId(db, { stripeCustomerId });
  if (!customerId) return;
  await db
    .from("customers")
    .update({ subscription_status: "past_due" })
    .eq("id", customerId);
}

async function onChargeRefunded(db: SupabaseClient, charge: Stripe.Charge) {
  const pi = asId(charge.payment_intent);
  if (!pi) return;
  await db
    .from("billing_history")
    .update({ status: "Refunded" })
    .eq("stripe_payment_intent_id", pi);
}
