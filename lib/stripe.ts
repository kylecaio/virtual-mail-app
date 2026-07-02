import Stripe from "stripe";

/**
 * Stripe server client + thin helpers for Virtual Mail (Phase 7).
 *
 * SERVER ONLY — reads STRIPE_SECRET_KEY. The publishable key
 * (NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY) is the only Stripe value the browser sees.
 *
 * We keep our own copy of subscription/customer state in Postgres, synced by the
 * webhook, so these helpers are deliberately minimal. apiVersion is intentionally
 * omitted so the SDK uses the account's default and we don't fight the type literal.
 */
// Fallback is a non-empty placeholder so module load never throws when the key is
// unset (e.g. during `next build` before Kyle adds secrets). Real requests use the
// real key at runtime and fail loudly if it's still the placeholder.
export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "sk_test_placeholder", {
  typescript: true,
  appInfo: { name: "virtual-mail", version: "0.1.0" },
});

/** Reuse an existing Stripe customer by email, else create one. */
export async function getOrCreateStripeCustomer(params: {
  email: string;
  name?: string | null;
  metadata?: Record<string, string>;
}): Promise<Stripe.Customer> {
  const found = await stripe.customers.list({ email: params.email, limit: 1 });
  if (found.data.length > 0) return found.data[0];
  return stripe.customers.create({
    email: params.email,
    name: params.name ?? undefined,
    metadata: params.metadata,
  });
}

/** Hosted Checkout for a subscription; also saves the card for off-session per-action charges. */
export async function createSubscriptionCheckout(params: {
  stripeCustomerId: string;
  priceId: string;
  successUrl: string;
  cancelUrl: string;
  clientReferenceId?: string;
  taxRateId?: string;
  metadata?: Record<string, string>;
}): Promise<Stripe.Checkout.Session> {
  return stripe.checkout.sessions.create({
    mode: "subscription",
    customer: params.stripeCustomerId,
    client_reference_id: params.clientReferenceId,
    line_items: [
      { price: params.priceId, quantity: 1, tax_rates: params.taxRateId ? [params.taxRateId] : undefined },
    ],
    // Save the payment method as the customer default so we can charge per-action off-session.
    payment_method_collection: "always",
    subscription_data: { metadata: params.metadata },
    metadata: params.metadata,
    success_url: params.successUrl,
    cancel_url: params.cancelUrl,
  });
}

/** Hosted Checkout for a one-time prepaid pack purchase (payment mode). */
export async function createPackageCheckout(params: {
  stripeCustomerId: string;
  priceId: string;
  successUrl: string;
  cancelUrl: string;
  clientReferenceId?: string;
  taxRateId?: string;
  metadata?: Record<string, string>;
}): Promise<Stripe.Checkout.Session> {
  return stripe.checkout.sessions.create({
    mode: "payment",
    customer: params.stripeCustomerId,
    client_reference_id: params.clientReferenceId,
    line_items: [
      { price: params.priceId, quantity: 1, tax_rates: params.taxRateId ? [params.taxRateId] : undefined },
    ],
    // Keep the card on file so it's available for off-session per-action charges too.
    payment_intent_data: { setup_future_usage: "off_session" },
    success_url: params.successUrl,
    cancel_url: params.cancelUrl,
    metadata: params.metadata,
  });
}

/** Billing Portal for change-plan / update-card / cancel. */
export async function createBillingPortalSession(params: {
  stripeCustomerId: string;
  returnUrl: string;
}): Promise<Stripe.BillingPortal.Session> {
  return stripe.billingPortal.sessions.create({
    customer: params.stripeCustomerId,
    return_url: params.returnUrl,
  });
}

/**
 * Off-session per-action charge (card fallback at fulfilment). Amount is in cents.
 * Throws Stripe.errors.StripeCardError on decline — the caller (block-until-paid) must
 * catch it and refrain from flipping mail state.
 */
export async function chargeOffSession(params: {
  stripeCustomerId: string;
  paymentMethodId: string;
  amountCents: number;
  description: string;
  metadata?: Record<string, string>;
}): Promise<Stripe.PaymentIntent> {
  return stripe.paymentIntents.create({
    customer: params.stripeCustomerId,
    payment_method: params.paymentMethodId,
    amount: params.amountCents,
    currency: "usd",
    confirm: true,
    off_session: true,
    description: params.description,
    metadata: params.metadata,
  });
}

/** Dollars → integer cents for Stripe amounts. */
export function toCents(dollars: number): number {
  return Math.round((dollars + Number.EPSILON) * 100);
}
