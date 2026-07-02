import { NextRequest, NextResponse } from "next/server";
import { getProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createBillingPortalSession } from "@/lib/stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Hosted Billing Portal for change-plan / update-card / cancel.
export async function POST(req: NextRequest) {
  const profile = await getProfile();
  if (!profile) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const supabase = createClient();
  const { data: customer } = await supabase
    .from("customers")
    .select("stripe_customer_id")
    .order("box_number")
    .limit(1)
    .maybeSingle();

  const stripeCustomerId = customer?.stripe_customer_id as string | null;
  if (!stripeCustomerId) {
    return NextResponse.json({ error: "no Stripe customer yet — subscribe first" }, { status: 400 });
  }

  const origin = process.env.NEXT_PUBLIC_SITE_URL ?? req.nextUrl.origin;
  try {
    const session = await createBillingPortalSession({
      stripeCustomerId,
      returnUrl: `${origin}/dashboard/billing`,
    });
    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error("portal error", err);
    return NextResponse.json({ error: "could not open billing portal" }, { status: 500 });
  }
}
