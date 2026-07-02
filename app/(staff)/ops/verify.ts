"use server";

// Phase 8b — verify moved server-side so it can send the "mail received" email.
// (Previously VerifyRow.tsx wrote mail_pieces directly via the RLS client, which
// left no server hook for notifications.) Staff-only; uses the service-role client.

import { getProfile } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { notify } from "@/lib/email";
import { mailboxEmail } from "@/lib/email-templates";

function portalUrl(): string {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? "https://big-oakland-mail.vercel.app";
  return `${base}/dashboard`;
}

async function requireStaffProfile() {
  const profile = await getProfile();
  if (!profile || (profile.role !== "staff" && profile.role !== "admin")) return null;
  return profile;
}

/** Assign a Pending-Verification piece to a customer, flip to Received, email them. */
export async function verifyPiece(
  serial: number,
  customerId: string
): Promise<{ ok: boolean; error?: string }> {
  const profile = await requireStaffProfile();
  if (!profile) return { ok: false, error: "Not authorized" };
  if (!customerId) return { ok: false, error: "Select a customer first." };

  const db = createAdminClient();

  const { data: piece, error } = await db
    .from("mail_pieces")
    .update({ customer_id: customerId, status: "Received" })
    .eq("serial", serial)
    .select("serial, sender")
    .maybeSingle();
  if (error) return { ok: false, error: error.message };

  // Best-effort "mail received" email — never blocks the verify.
  const { data: customer } = await db
    .from("customers")
    .select("email, name")
    .eq("id", customerId)
    .maybeSingle();
  if (customer?.email) {
    const tpl = mailboxEmail("mail_received", {
      name: customer.name,
      serial,
      sender: piece?.sender,
      portalUrl: portalUrl(),
    });
    await notify({
      to: customer.email,
      dedupeKey: `mail_received:${serial}`,
      event: "mail_received",
      subject: tpl.subject,
      html: tpl.html,
      text: tpl.text,
      customerId,
    });
  }

  return { ok: true };
}

/** Exception path (no email): Address Correction / Return to Sender. */
export async function flagException(
  serial: number,
  status: "Address Correction" | "Return to Sender"
): Promise<{ ok: boolean; error?: string }> {
  const profile = await requireStaffProfile();
  if (!profile) return { ok: false, error: "Not authorized" };

  const db = createAdminClient();
  const { error } = await db.from("mail_pieces").update({ status }).eq("serial", serial);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
