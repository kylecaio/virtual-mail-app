// Checkable money math for Virtual Mail services.
// All functions are pure and reconcile to platform/docs/PRICING.md.
// The admin pricing editor renders live worked examples from these so an
// admin sees the effect of a rate change immediately, and so the math is
// verifiable against the PRICING.md example calculations.

export type PricingRule = {
  id: string;
  service_type: string;
  charge_type: "flat_fee" | "per_page" | "per_day" | "per_month" | "percentage";
  base_amount: number;
  included_units: number;
  overage_amount: number | null;
  min_charge: number | null;
  max_charge: number | null;
  is_active: boolean;
};

export type ShippingMargin = {
  id: string;
  carrier: string;
  service_type: string;
  margin_multiplier: number;
  handling_fee: number;
  is_active: boolean;
};

export type Plan = {
  id: string;
  name: string;
  monthly_price: number;
  annual_price: number | null;
  included_items: number;
  overage_rate: number;
  free_storage_days: number;
  is_active: boolean;
  display_order: number;
  stripe_price_id?: string | null;
};

export type Package = {
  id: string;
  name: string;
  service_type: string;
  quantity: number;
  bonus: number;
  price: number;
  stripe_price_id: string | null;
  is_active: boolean;
  display_order: number;
};

export const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

const ruleOf = (rules: PricingRule[], serviceType: string) =>
  rules.find((r) => r.service_type === serviceType);

// Scan / shred: base covers `included_units` pages, then overage per extra page.
export function tieredPageCost(rule: PricingRule | undefined, pages: number): number {
  if (!rule) return 0;
  const extra = Math.max(0, pages - rule.included_units);
  const cost = Number(rule.base_amount) + extra * Number(rule.overage_amount ?? 0);
  return round2(cost);
}

export function scanCost(rules: PricingRule[], pages: number, express = false): number {
  return tieredPageCost(ruleOf(rules, express ? "express_scan" : "scan"), pages);
}

export function shredCost(rules: PricingRule[], pages: number): number {
  return tieredPageCost(ruleOf(rules, "shred"), pages);
}

// Forwarding = postage + carrier margin + carrier handling + flat forward handling.
export function forwardCost(
  rules: PricingRule[],
  margin: ShippingMargin,
  postage: number,
): { postage: number; margin: number; carrierHandling: number; forwardHandling: number; total: number } {
  const forwardHandling = Number(ruleOf(rules, "forward_handling")?.base_amount ?? 0);
  const marginAmt = round2(postage * (Number(margin.margin_multiplier) - 1));
  const carrierHandling = Number(margin.handling_fee);
  const total = round2(postage + marginAmt + carrierHandling + forwardHandling);
  return { postage, margin: marginAmt, carrierHandling, forwardHandling, total };
}

// Storage: free for `freeDays`, then daily rate per item, capped per item/month.
export function storageCost(
  rules: PricingRule[],
  totalDays: number,
  items: number,
  freeDays = 30,
): number {
  const daily = Number(ruleOf(rules, "storage_daily")?.base_amount ?? 0);
  const cap = Number(ruleOf(rules, "storage_monthly_cap")?.base_amount ?? Infinity);
  const billableDays = Math.max(0, totalDays - freeDays);
  const perItemMonths = billableDays / 30;
  const perItemUncapped = billableDays * daily;
  const perItem = Math.min(perItemUncapped, cap * Math.max(1, Math.ceil(perItemMonths || 0)) );
  // Simple model matching PRICING.md example (no full month accrued yet -> uncapped):
  const perItemSimple = billableDays * daily;
  return round2(perItemSimple * items);
}

export function overageCost(plan: Plan, itemsUsed: number): number {
  const extra = Math.max(0, itemsUsed - plan.included_items);
  return round2(extra * Number(plan.overage_rate));
}

export function salesTaxRate(rules: PricingRule[]): number {
  return Number(ruleOf(rules, "sales_tax")?.base_amount ?? 0) / 100;
}

// --- Per-action fulfilment charging (Phase 7d) ---------------------------

export type BillableAction = "Scan" | "Forward" | "Shred" | "Recycle" | "Pickup" | "Consolidate";

// The credit ledger key a given action consumes (aligns with packages.service_type).
// Recycle has no credit type (it's free). Express scans consume the 'express_scan' pool.
export function creditKeyForAction(action: BillableAction, express = false): string | null {
  switch (action) {
    case "Scan": return express ? "express_scan" : "scan";
    case "Forward": return "forward";
    case "Shred": return "shred";
    case "Pickup": return "local_pickup";
    case "Consolidate": return "consolidation";
    case "Recycle": return null;
    default: return null;
  }
}

/**
 * Pre-tax fee for a fulfilment action, computed from the current pricing rows.
 * Forward is computed separately (needs postage + a carrier margin) via forwardCost.
 * Pickup is free on Premium/Enterprise plans (per PRICING.md).
 */
export function perActionFee(
  rules: PricingRule[],
  plan: Plan | null,
  action: Exclude<BillableAction, "Forward">,
  opts: { pages?: number; express?: boolean } = {}
): number {
  const pages = opts.pages ?? 0;
  switch (action) {
    case "Scan": return scanCost(rules, pages, opts.express ?? false);
    case "Shred": return shredCost(rules, pages);
    case "Recycle": return 0; // no recycle rule → free
    case "Pickup": {
      const base = Number(ruleOf(rules, "local_pickup")?.base_amount ?? 0);
      const free = !!plan && /premium|enterprise/i.test(plan.name);
      return free ? 0 : round2(base);
    }
    case "Consolidate": return round2(Number(ruleOf(rules, "consolidation")?.base_amount ?? 0));
    default: return 0;
  }
}

// Worked examples straight from PRICING.md, computed live from current rules.
export function workedExamples(rules: PricingRule[], margins: ShippingMargin[]) {
  const priority = margins.find((m) => m.carrier === "USPS" && m.service_type === "Priority Mail");
  const scan15 = scanCost(rules, 15);
  const fwd = priority ? forwardCost(rules, priority, 8.5) : null;
  const storage = storageCost(rules, 45, 3);
  return { scan15, fwd, storage };
}
