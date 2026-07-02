// Phase 8b/8c — email templates (Oakland Mailbox brand).
// Pure functions returning { subject, html, text }. No side effects.

export type MailboxEvent =
  | "mail_received"
  | "scanned"
  | "forwarded"
  | "shredded"
  | "recycled"
  | "picked_up";

export type PaymentEvent =
  | "welcome"
  | "pack_purchased"
  | "subscription_paid"
  | "payment_failed"
  | "overage_charged";

export type TemplateData = {
  name?: string | null;
  serial: number | string;
  sender?: string | null;
  portalUrl: string;
  scanUrl?: string | null; // reserved for signed-URL scan delivery (8b refinement)
  tracking?: string | null;
  chargeNote?: string | null; // 8c: per-action charge line appended to fulfilment emails
};

export type PaymentData = {
  name?: string | null;
  portalUrl: string;
  billingUrl?: string | null;
  amount?: number | null; // dollars
  packName?: string | null;
  credits?: number | null;
  serviceType?: string | null;
  planName?: string | null;
  periodLabel?: string | null;
  itemsOver?: number | null;
};

const BRAND = "Oakland Mailbox";
const ADDRESS = "123 Broadway, Oakland, CA 94607";
const money = (n: number | null | undefined) => `$${Number(n ?? 0).toFixed(2)}`;

function layout(bodyHtml: string, portalUrl: string, ctaLabel = "View your mailbox"): string {
  return `<div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;max-width:520px;margin:0 auto;color:#1a1a1a;line-height:1.5;">
  <h2 style="font-size:18px;margin:0 0 16px;">${BRAND}</h2>
  ${bodyHtml}
  <p style="margin:24px 0 0;"><a href="${portalUrl}" style="color:#2b5cff;text-decoration:none;">${ctaLabel} →</a></p>
  <hr style="border:none;border-top:1px solid #eee;margin:24px 0 12px;">
  <p style="font-size:12px;color:#888;margin:0;">${BRAND} · ${ADDRESS}</p>
</div>`;
}

// ─── Mailbox events (8b) ──────────────────────────────────────────────────────

export function mailboxEmail(
  event: MailboxEvent,
  d: TemplateData
): { subject: string; html: string; text: string } {
  const piece = `#${d.serial}`;
  const fromHtml = d.sender ? ` from <strong>${d.sender}</strong>` : "";
  const fromText = d.sender ? ` from ${d.sender}` : "";

  let subject: string;
  let bodyHtml: string;
  let bodyText: string;

  switch (event) {
    case "mail_received":
      subject = `New mail received — ${piece}`;
      bodyHtml = `<p>You've received new mail${fromHtml} in your Oakland Mailbox (${piece}). Sign in to scan, forward, shred, recycle, or schedule a pickup.</p>`;
      bodyText = `New mail received (${piece})${fromText}. Sign in to your Oakland Mailbox.`;
      break;
    case "scanned":
      subject = `Your scan is ready — ${piece}`;
      bodyHtml =
        `<p>Mail piece ${piece}${fromHtml} has been scanned and is ready to view in your mailbox.</p>` +
        (d.scanUrl ? `<p><a href="${d.scanUrl}" style="color:#2b5cff;">Download the scan</a> (link expires shortly for security).</p>` : "");
      bodyText = `Your scan for ${piece} is ready.` + (d.scanUrl ? ` Download (expires shortly): ${d.scanUrl}.` : "");
      break;
    case "forwarded":
      subject = `Mail forwarded — ${piece}`;
      bodyHtml = `<p>Mail piece ${piece}${fromHtml} has been forwarded.` + (d.tracking ? ` Tracking number: <strong>${d.tracking}</strong>.` : "") + `</p>`;
      bodyText = `Mail ${piece} has been forwarded.` + (d.tracking ? ` Tracking: ${d.tracking}.` : "");
      break;
    case "shredded":
      subject = `Mail shredded — ${piece}`;
      bodyHtml = `<p>Mail piece ${piece}${fromHtml} has been securely shredded, as requested.</p>`;
      bodyText = `Mail ${piece} has been securely shredded.`;
      break;
    case "recycled":
      subject = `Mail recycled — ${piece}`;
      bodyHtml = `<p>Mail piece ${piece}${fromHtml} has been recycled, as requested.</p>`;
      bodyText = `Mail ${piece} has been recycled.`;
      break;
    case "picked_up":
      subject = `Mail picked up — ${piece}`;
      bodyHtml = `<p>Mail piece ${piece}${fromHtml} has been marked as picked up at ${ADDRESS}.</p>`;
      bodyText = `Mail ${piece} has been picked up at ${ADDRESS}.`;
      break;
  }

  if (d.chargeNote) {
    bodyHtml += `<p style="color:#555;">${d.chargeNote}</p>`;
    bodyText += ` ${d.chargeNote}`;
  }

  return {
    subject,
    html: layout(bodyHtml, d.portalUrl),
    text: `${bodyText} ${d.portalUrl}`.trim(),
  };
}

// ─── Payment events (8c) ────────────────────────────────────────────────────

export function paymentEmail(
  event: PaymentEvent,
  d: PaymentData
): { subject: string; html: string; text: string } {
  const billing = d.billingUrl ?? d.portalUrl;

  switch (event) {
    case "welcome":
      return {
        subject: `Welcome to ${BRAND}`,
        html: layout(
          `<p>${d.name ? `Hi ${d.name}, ` : ""}your ${BRAND} mailbox is active${d.planName ? ` on the <strong>${d.planName}</strong> plan` : ""}. ` +
            `You can now receive mail at ${ADDRESS} and request scans, forwarding, shredding, recycling, or local pickup — all from your dashboard.</p>`,
          d.portalUrl,
          "Go to your mailbox"
        ),
        text: `Welcome to ${BRAND}. Your mailbox is active${d.planName ? ` on the ${d.planName} plan` : ""}. Dashboard: ${d.portalUrl}`,
      };
    case "pack_purchased":
      return {
        subject: `Your ${d.packName ?? "credit pack"} is ready`,
        html: layout(
          `<p>Thanks for your purchase. <strong>${d.credits ?? ""} ${d.serviceType ?? ""} credit${(d.credits ?? 0) === 1 ? "" : "s"}</strong> ` +
            `have been added to your account. Charged: <strong>${money(d.amount)}</strong>.</p>`,
          billing,
          "View billing"
        ),
        text: `Your ${d.packName ?? "credit pack"} is ready — ${d.credits ?? ""} ${d.serviceType ?? ""} credits added. Charged ${money(d.amount)}. Billing: ${billing}`,
      };
    case "subscription_paid":
      return {
        subject: `Payment received — ${money(d.amount)}`,
        html: layout(
          `<p>We've received your monthly subscription payment of <strong>${money(d.amount)}</strong>${d.planName ? ` for the ${d.planName} plan` : ""}. Thank you.</p>`,
          billing,
          "View billing"
        ),
        text: `Payment received: ${money(d.amount)}${d.planName ? ` (${d.planName} plan)` : ""}. Billing: ${billing}`,
      };
    case "payment_failed":
      return {
        subject: `Payment failed — action needed`,
        html: layout(
          `<p>We couldn't process your latest ${BRAND} payment, so your account is now past due. ` +
            `Please update your payment method to keep your mailbox active.</p>`,
          billing,
          "Update payment method"
        ),
        text: `Your ${BRAND} payment failed and your account is past due. Update your payment method: ${billing}`,
      };
    case "overage_charged":
      return {
        subject: `Overage added to your next invoice — ${money(d.amount)}`,
        html: layout(
          `<p>You received ${d.itemsOver ?? ""} item${(d.itemsOver ?? 0) === 1 ? "" : "s"} over your ${d.planName ?? "plan"} allowance` +
            `${d.periodLabel ? ` in ${d.periodLabel}` : ""}. An overage charge of <strong>${money(d.amount)}</strong> has been added to your next invoice.</p>`,
          billing,
          "View billing"
        ),
        text: `Overage of ${money(d.amount)} (${d.itemsOver ?? ""} items over ${d.planName ?? "plan"}${d.periodLabel ? `, ${d.periodLabel}` : ""}) added to your next invoice. Billing: ${billing}`,
      };
  }
}
