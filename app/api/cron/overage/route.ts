import { NextRequest, NextResponse } from "next/server";
import { stripe, toCents } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { overageCost, type Plan } from "@/lib/pricing";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Monthly overage sweep (7e). Wired to Vercel Cron (see vercel.json).
 * For the just-closed calendar month, counts pieces received per customer vs their
 * plan allowance; for any excess, adds a Stripe invoice item (picked up on the next
 * subscription invoice) and records a Pending Overage billing_history row.
 *
 * Guarded by CRON_SECRET (Vercel Cron sends it as a Bearer token when configured).
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const db = createAdminClient();

  // Previous calendar month [start, end).
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const periodLabel = start.toLocaleString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });

  const [{ data: plans }, { data: customers }, { data: pieces }] = await Promise.all([
    db.from("plans").select("*"),
    db
      .from("customers")
      .select("id, plan_id, stripe_customer_id, subscription_status")
      .not("plan_id", "is", null),
    db
      .from("mail_pieces")
      .select("customer_id, received_at")
      .gte("received_at", start.toISOString())
      .lt("received_at", end.toISOString()),
  ]);

  const planById = new Map<string, Plan>((plans ?? []).map((p: any) => [p.id, p as Plan]));
  const countByCustomer = new Map<string, number>();
  for (const p of (pieces ?? []) as any[]) {
    if (!p.customer_id) continue;
    countByCustomer.set(p.customer_id, (countByCustomer.get(p.customer_id) ?? 0) + 1);
  }

  const results: { customer_id: string; used: number; overage: number; billed: boolean; note?: string }[] = [];

  for (const c of (customers ?? []) as any[]) {
    const plan = c.plan_id ? planById.get(c.plan_id) : null;
    if (!plan) continue;
    const used = countByCustomer.get(c.id) ?? 0;
    const overage = overageCost(plan, used);
    if (overage <= 0) continue;

    let billed = false;
    let note: string | undefined;
    try {
      if (c.stripe_customer_id && c.subscription_status === "active") {
        await stripe.invoiceItems.create({
          customer: c.stripe_customer_id,
          amount: toCents(overage),
          currency: "usd",
          description: `Overage — ${used - plan.included_items} items over plan (${periodLabel})`,
        });
        billed = true;
      } else {
        note = "no active subscription — recorded Pending only";
      }
    } catch (err: any) {
      note = `stripe error: ${err?.message ?? "unknown"}`;
    }

    await db.from("billing_history").insert({
      customer_id: c.id,
      amount: overage,
      type: "Overage",
      status: "Pending",
      source: "invoice",
      description: `Overage — ${used - plan.included_items} items over ${plan.name} (${periodLabel})`,
    });

    results.push({ customer_id: c.id, used, overage, billed, note });
  }

  return NextResponse.json({ period: periodLabel, swept: results.length, results });
}
