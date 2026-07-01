import { requireUser } from "@/lib/auth";
import { getMyCustomer } from "@/lib/customer";
import { createClient } from "@/lib/supabase/server";
import { INBOX_STATUSES } from "@/lib/ui/MailStatus";
import DashboardNav from "./DashboardNav";
import RequestRow from "./RequestRow";
import NoMailbox from "./NoMailbox";

export const dynamic = "force-dynamic";

export default async function InboxPage() {
  const profile = await requireUser();
  const customer = await getMyCustomer();

  if (!customer) {
    return (
      <div>
        <DashboardNav />
        <NoMailbox email={profile.email} />
      </div>
    );
  }

  const supabase = createClient();
  const { data: pieces } = await supabase
    .from("mail_pieces")
    .select("id, serial, sender, type, status, received_at, envelope_image, scan_pdf")
    .in("status", INBOX_STATUSES)
    .order("received_at", { ascending: false });

  const th = "px-4 py-2 text-left font-medium text-inkMuted";
  const list = pieces ?? [];

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-serif text-2xl font-semibold text-ink">Your mailbox</h1>
        <p className="mt-1 text-inkMuted">
          Box #{customer.box_number}
          {customer.company ? ` · ${customer.company}` : ""} · {list.length} piece{list.length === 1 ? "" : "s"} awaiting your instruction.
        </p>
      </div>

      <DashboardNav />

      <div className="overflow-hidden rounded-theme border border-border">
        <table className="w-full text-sm">
          <thead className="bg-surfaceAlt">
            <tr>
              <th className={th}>Serial</th>
              <th className={th}>Sender</th>
              <th className={th}>Type</th>
              <th className={th}>Received</th>
              <th className={th}>Status</th>
              <th className={th}>Request an action</th>
            </tr>
          </thead>
          <tbody className="bg-surface">
            {list.map((p: any) => (
              <RequestRow key={p.id} piece={p} defaultForwarding={customer.forwarding_address} />
            ))}
            {list.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-inkSubtle">
                  No mail waiting. New pieces appear here once our staff log and verify them.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <p className="mt-3 text-xs text-inkSubtle">
        Requested items move to <span className="font-medium">In progress</span> until our staff fulfil them.
      </p>
    </div>
  );
}
