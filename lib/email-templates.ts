// Phase 8b — mailbox-event email templates (Oakland Mailbox brand).
// Pure functions returning { subject, html, text }. No side effects.

export type MailboxEvent =
  | "mail_received"
  | "scanned"
  | "forwarded"
  | "shredded"
  | "recycled"
  | "picked_up";

export type TemplateData = {
  name?: string | null;
  serial: number | string;
  sender?: string | null;
  portalUrl: string;
  scanUrl?: string | null; // reserved for signed-URL scan delivery (8b refinement)
  tracking?: string | null;
};

const BRAND = "Oakland Mailbox";
const ADDRESS = "123 Broadway, Oakland, CA 94607";

function layout(bodyHtml: string, portalUrl: string): string {
  return `<div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;max-width:520px;margin:0 auto;color:#1a1a1a;line-height:1.5;">
  <h2 style="font-size:18px;margin:0 0 16px;">${BRAND}</h2>
  ${bodyHtml}
  <p style="margin:24px 0 0;"><a href="${portalUrl}" style="color:#2b5cff;text-decoration:none;">View your mailbox →</a></p>
  <hr style="border:none;border-top:1px solid #eee;margin:24px 0 12px;">
  <p style="font-size:12px;color:#888;margin:0;">${BRAND} · ${ADDRESS}</p>
</div>`;
}

export function mailboxEmail(
  event: MailboxEvent,
  d: TemplateData
): { subject: string; html: string; text: string } {
  const piece = `#${d.serial}`;
  const fromHtml = d.sender ? ` from <strong>${d.sender}</strong>` : "";
  const fromText = d.sender ? ` from ${d.sender}` : "";

  switch (event) {
    case "mail_received":
      return {
        subject: `New mail received — ${piece}`,
        html: layout(
          `<p>You've received new mail${fromHtml} in your Oakland Mailbox (${piece}). Sign in to scan, forward, shred, recycle, or schedule a pickup.</p>`,
          d.portalUrl
        ),
        text: `New mail received (${piece})${fromText}. Sign in to your Oakland Mailbox: ${d.portalUrl}`,
      };
    case "scanned":
      return {
        subject: `Your scan is ready — ${piece}`,
        html: layout(
          `<p>Mail piece ${piece}${fromHtml} has been scanned and is ready to view in your mailbox.</p>` +
            (d.scanUrl
              ? `<p><a href="${d.scanUrl}" style="color:#2b5cff;">Download the scan</a> (link expires shortly for security).</p>`
              : ""),
          d.portalUrl
        ),
        text:
          `Your scan for ${piece} is ready.` +
          (d.scanUrl ? ` Download (expires shortly): ${d.scanUrl}.` : "") +
          ` View in your mailbox: ${d.portalUrl}`,
      };
    case "forwarded":
      return {
        subject: `Mail forwarded — ${piece}`,
        html: layout(
          `<p>Mail piece ${piece}${fromHtml} has been forwarded.` +
            (d.tracking ? ` Tracking number: <strong>${d.tracking}</strong>.` : "") +
            `</p>`,
          d.portalUrl
        ),
        text:
          `Mail ${piece} has been forwarded.` +
          (d.tracking ? ` Tracking: ${d.tracking}.` : "") +
          ` ${d.portalUrl}`,
      };
    case "shredded":
      return {
        subject: `Mail shredded — ${piece}`,
        html: layout(
          `<p>Mail piece ${piece}${fromHtml} has been securely shredded, as requested.</p>`,
          d.portalUrl
        ),
        text: `Mail ${piece} has been securely shredded. ${d.portalUrl}`,
      };
    case "recycled":
      return {
        subject: `Mail recycled — ${piece}`,
        html: layout(
          `<p>Mail piece ${piece}${fromHtml} has been recycled, as requested.</p>`,
          d.portalUrl
        ),
        text: `Mail ${piece} has been recycled. ${d.portalUrl}`,
      };
    case "picked_up":
      return {
        subject: `Mail picked up — ${piece}`,
        html: layout(
          `<p>Mail piece ${piece}${fromHtml} has been marked as picked up at ${ADDRESS}.</p>`,
          d.portalUrl
        ),
        text: `Mail ${piece} has been picked up at ${ADDRESS}. ${d.portalUrl}`,
      };
  }
}
