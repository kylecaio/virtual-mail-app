// Phase 8a — outbound email foundation (Resend).
//
// SERVER ONLY. Uses the service-role Supabase client to write `email_log`, so it
// runs from server actions / API routes / webhooks that have already authorized
// the caller. Sending is BEST-EFFORT: a failure is logged to `email_log` and
// returned, but never throws into (or blocks) the primary action.
//
// Idempotency = CLAIM-FIRST. Every send carries a `dedupeKey`. We insert the
// `email_log` row (status 'sending') BEFORE calling Resend; the unique index on
// dedupe_key means a concurrent/retried run gets a conflict and skips. Only after
// a successful claim do we send, then flip the row to 'sent' (+ provider id) or
// 'failed' (+ error). "Send then log" would not prevent a double-send on retry.
//
// Sending identity comes from env (Oakland Mailbox brand, 2026-07-01):
//   EMAIL_FROM      e.g. "Oakland Mailbox <hello@notifications.oaklandmailbox.com>"
//   EMAIL_REPLY_TO  e.g. "hello@oaklandmailbox.com"
// Until RESEND_API_KEY is set, notify() no-ops gracefully (logs 'skipped').

import { Resend } from "resend";
import { createAdminClient } from "@/lib/supabase/admin";

export type NotifyParams = {
  /** Recipient email address. */
  to: string;
  /** Stable idempotency key, e.g. `mail_received:${mailPieceId}`. Must be unique per intended send. */
  dedupeKey: string;
  /** Event type for logging/filtering, e.g. "mail_received", "scan_ready", "welcome". */
  event: string;
  subject: string;
  html: string;
  text?: string;
  /** Optional link back to the customer for admin log / debugging. */
  customerId?: number | string | null;
  metadata?: Record<string, unknown> | null;
  /**
   * Preference category (8d). When set with a customerId, the send is suppressed
   * if the customer has that toggle off, and a manage-preferences/unsubscribe
   * footer is appended. Omit (undefined/null) for critical payment/account mail,
   * which always sends and carries no unsubscribe link.
   */
  pref?: PrefCategory | null;
};

export type PrefCategory = "mail" | "requests" | "billing" | "marketing";

const PREF_COLUMN: Record<PrefCategory, string> = {
  mail: "notify_mail",
  requests: "notify_requests",
  billing: "notify_billing",
  marketing: "notify_marketing",
};

export type NotifyResult =
  | { ok: true; skipped?: false; providerId: string | null }
  | { ok: false; skipped?: false; error: string }
  | { ok: false; skipped: true; reason: string };

const siteBase = () => process.env.NEXT_PUBLIC_SITE_URL ?? "https://big-oakland-mail.vercel.app";

const FROM = () => process.env.EMAIL_FROM ?? "Oakland Mailbox <hello@notifications.oaklandmailbox.com>";
const REPLY_TO = () => process.env.EMAIL_REPLY_TO ?? undefined;

let _resend: Resend | null = null;
function getResend(): Resend | null {
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  if (!_resend) _resend = new Resend(key);
  return _resend;
}

/**
 * Claim-first, best-effort send. Returns a result object; never throws.
 */
export async function notify(params: NotifyParams): Promise<NotifyResult> {
  const admin = createAdminClient();

  // 0. Preference gate + unsubscribe footer (8d). Critical mail passes no pref.
  let html = params.html;
  let text = params.text;
  if (params.pref && params.customerId != null) {
    const col = PREF_COLUMN[params.pref];
    // Static select string (a dynamic `${col}` breaks Supabase's select-string typing).
    const { data } = await admin
      .from("customers")
      .select("notify_mail, notify_requests, notify_billing, notify_marketing, unsubscribe_token")
      .eq("id", String(params.customerId))
      .maybeSingle();
    const row = (data as Record<string, unknown> | null) ?? null;
    if (row && row[col] === false) {
      return { ok: false, skipped: true, reason: "pref_off" };
    }
    const token = row?.unsubscribe_token as string | undefined;
    if (token) {
      const url = `${siteBase()}/unsubscribe?token=${token}`;
      html += `<p style="font-size:12px;color:#aaa;margin-top:16px;">Manage email preferences or unsubscribe: <a href="${url}" style="color:#aaa;">${url}</a></p>`;
      text = `${text ?? ""}\n\nManage email preferences or unsubscribe: ${url}`;
    }
  }

  // 1. Claim the row. Unique dedupe_key → a duplicate insert conflicts and we skip.
  const { error: claimError } = await admin.from("email_log").insert({
    dedupe_key: params.dedupeKey,
    recipient: params.to,
    event: params.event,
    status: "sending",
    customer_id: params.customerId != null ? String(params.customerId) : null,
    metadata: params.metadata ?? null,
  });

  if (claimError) {
    // 23505 = unique_violation → another run owns this send; skip silently.
    if ((claimError as { code?: string }).code === "23505") {
      return { ok: false, skipped: true, reason: "duplicate" };
    }
    // Could not claim for another reason — do not send (avoid unlogged sends).
    return { ok: false, error: `email_log claim failed: ${claimError.message}` };
  }

  // 2. If Resend isn't configured yet, mark skipped and return (no throw).
  const resend = getResend();
  if (!resend) {
    await admin
      .from("email_log")
      .update({ status: "skipped", error: "RESEND_API_KEY not set", updated_at: new Date().toISOString() })
      .eq("dedupe_key", params.dedupeKey);
    return { ok: false, skipped: true, reason: "resend_not_configured" };
  }

  // 3. Send, then record outcome.
  try {
    const { data, error } = await resend.emails.send({
      from: FROM(),
      to: params.to,
      replyTo: REPLY_TO(),
      subject: params.subject,
      html,
      text,
    });
    if (error) {
      await admin
        .from("email_log")
        .update({ status: "failed", error: error.message, updated_at: new Date().toISOString() })
        .eq("dedupe_key", params.dedupeKey);
      return { ok: false, error: error.message };
    }
    await admin
      .from("email_log")
      .update({ status: "sent", provider_id: data?.id ?? null, updated_at: new Date().toISOString() })
      .eq("dedupe_key", params.dedupeKey);
    return { ok: true, providerId: data?.id ?? null };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    await admin
      .from("email_log")
      .update({ status: "failed", error: message, updated_at: new Date().toISOString() })
      .eq("dedupe_key", params.dedupeKey);
    return { ok: false, error: message };
  }
}

/**
 * Admin test send (8e). Fresh dedupe key each call so it always attempts a send.
 */
export async function sendTestEmail(to: string): Promise<NotifyResult> {
  return notify({
    to,
    dedupeKey: `test:${to}:${Date.now()}`,
    event: "admin_test",
    subject: "Oakland Mailbox — test email",
    html: `<p>This is a test email from Oakland Mailbox (Phase 8 notifications).</p>
           <p>If you received this, Resend + your sending domain are configured correctly.</p>`,
    text: "This is a test email from Oakland Mailbox (Phase 8 notifications). If you received this, Resend + your sending domain are configured correctly.",
  });
}
