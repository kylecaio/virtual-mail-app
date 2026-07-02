import { NextRequest, NextResponse } from "next/server";
import { getProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  getOrCreateStripeCustomer,
  createSubscriptionCheckout,
  createPackageCheckout,
} from "@/lib/stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Body: { kind: "subscription", planId } | { kind: "package", packageId }
export async function POST(req: NextRequest) {
  const profile = await getProfile();
  if (!profile) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const kind = body?.kind as "subscription" | "package" | undefined;
  if (kind !== "subscription" && kind !== "package") {
    return NextResponse.json({ error: "invalid kind" }, { status: 400 });
  }

  // The signed-in customer (RLS returns only their own row).
  const supabase = createClient();
  const { data: customer } = await supabase
    .from("customers")
    .select("id, name, email, stripe_customer_id")
    .order("box_number")
    .limit(1)
    .maybeSingle();
  if (!customer) {
    return NextResponse.json({ error: "no mailbox linked to this account" }, { status: 400 });
  }

  const email = customer.email ?? profile.email;
  if (!email) return NextResponse.json({ error: "no email on file" }, { status: 400 });

  // Ensure a Stripe customer, persisted via the service-role client (customers is staff-write under RLS).
  const admin = createAdminClient();
  let stripeCustomerId = customer.stripe_customer_id as string | null;
  if (!stripeCustomerId) {
    const sc = await getOrCreateStripeCustomer({
      email,
      name: customer.name,
      metadata: { supabase_customer_id: customer.id },
    });
    stripeCustomerId = sc.id;
    await admin.from("customers").update({ stripe_customer_id: stripeCustomerId }).eq("id", customer.id);
  }

  const origin = process.env.NEXT_PUBLIC_SITE_URL ?? req.nextUrl.origin;
  const successUrl = `${origin}/dashboard/billing?checkout=success`;
  const cancelUrl = `${origin}/dashboard/billing?checkout=cancel`;
  const taxRateId = process.env.STRIPE_TAX_RATE_ID || undefined;

  try {
    if (kind === "subscription") {
      const { data: plan } = await supabase
        .from("plans")
        .select("id, name, stripe_price_id")
        .eq("id", body.planId)
        .maybeSingle();
      if (!plan?.stripe_price_id) {
        return NextResponse.json(
          { error: "This plan isn't wired to Stripe yet (missing price id)." },
          { status: 400 }
        );
      }
      const session = await createSubscriptionCheckout({
        stripeCustomerId,
        priceId: plan.stripe_price_id,
        clientReferenceId: customer.id,
        taxRateId,
        successUrl,
        cancelUrl,
        metadata: { supabase_customer_id: customer.id, plan_id: plan.id },
      });
      return NextResponse.json({ url: session.url });
    }

    // package
    const { data: pkg } = await supabase
      .from("packages")
      .select("id, name, stripe_price_id")
      .eq("id", body.packageId)
      .eq("is_active", true)
      .maybeSingle();
    if (!pkg?.stripe_price_id) {
      return NextResponse.json(
        { error: "This pack isn't wired to Stripe yet (missing price id)." },
        { status: 400 }
      );
    }
    const session = await createPackageCheckout({
      stripeCustomerId,
      priceId: pkg.stripe_price_id,
      clientReferenceId: customer.id,
      taxRateId,
      successUrl,
      cancelUrl,
      metadata: { supabase_customer_id: customer.id, package_id: pkg.id },
    });
    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error("checkout error", err);
    return NextResponse.json({ error: "could not start checkout" }, { status: 500 });
  }
}
