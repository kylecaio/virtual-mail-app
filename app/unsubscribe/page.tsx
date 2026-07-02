// Phase 8d — public email-preferences / unsubscribe page (no login).
// Reached from the footer link in notification emails: /unsubscribe?token=<uuid>.
// The token identifies the customer; we load + update only that row via service role.

import { createAdminClient } from "@/lib/supabase/admin";
import UnsubForm from "./UnsubForm";

export const dynamic = "force-dynamic";

export default async function UnsubscribePage({
  searchParams,
}: {
  searchParams: { token?: string };
}) {
  const token = searchParams.token ?? "";
  let customer:
    | { notify_mail: boolean; notify_requests: boolean; notify_billing: boolean; notify_marketing: boolean; email: string | null }
    | null = null;

  if (token) {
    const admin = createAdminClient();
    const { data } = await admin
      .from("customers")
      .select("notify_mail, notify_requests, notify_billing, notify_marketing, email")
      .eq("unsubscribe_token", token)
      .maybeSingle();
    customer = (data as typeof customer) ?? null;
  }

  return (
    <main className="mx-auto max-w-lg px-4 py-12">
      <h1 className="font-serif text-2xl font-semibold text-ink">Oakland Mailbox — email preferences</h1>
      {!customer ? (
        <p className="mt-4 text-inkMuted">
          This preferences link is invalid or has expired. If you have an account, you can manage
          email preferences from your dashboard settings.
        </p>
      ) : (
        <>
          <p className="mt-2 mb-5 text-sm text-inkMuted">
            Choose which emails {customer.email ? `${customer.email} receives` : "you receive"} from Oakland Mailbox.
          </p>
          <UnsubForm
            token={token}
            initial={{
              mail: customer.notify_mail,
              requests: customer.notify_requests,
              billing: customer.notify_billing,
              marketing: customer.notify_marketing,
            }}
          />
        </>
      )}
    </main>
  );
}
