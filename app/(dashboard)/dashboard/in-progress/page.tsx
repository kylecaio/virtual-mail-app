import { requireUser } from "@/lib/auth";
import { getMyCustomer } from "@/lib/customer";
import { createClient } from "@/lib/supabase/server";
import { StatusBadge, IN_PROGRESS_STATUSES } from "@/lib/ui/MailStatus";
import DashboardNav from "../DashboardNav";
import NoMailbox from "../NoMailbox";

export const dynamic = "force-dynamic";

export default async function InProgressPage() {
  const profile = await requireUser();
  const customer = await getMyCustomer();
  if (!customer) {
    return (<div><DashboardNav /><NoMailbox email={profile.email} /></div>);
  }

  const supabase = createClient();
  const { data: pieces } = await supabase
    .from("mail_pieces")
    .select("id, serial, sender, type, status, request, requested_at")
    .in("status", IN_PROGRESS_STATUSES)
    .order("requested_at", { ascending: false });

  const th = "px-4 py-2 text-left font-medium text-inkMuted";
  const list = pieces ?? [];

  return (
    <div>
      <h1 className="mb-6 font-serif text-2xl font-semibold text-ink">In progress</h1>
      <DashboardNav />
      <div className="overflow-hidden rounded-theme border border-border">
        <table className="w-full text-sm">
          <thead className="bg-surfaceAlt">
            <tr>
              <th className={th}>Serial</th>
              <th className={th}>Sender</th>
              <th className={th}>Requested</th>
              <th className={th}>Requested on</th>
              <th className={th}>Status</th>
            </tr>
          </thead>
          <tbody className="bg-surface">
            {list.map((p: any) => (
              <tr key={p.id} className="border-t border-border">
                <td className="px-4 py-3 font-mono text-ink">#{p.serial}</td>
                <td className="px-4 py-3 text-inkMuted">{p.sender || "—"}</td>
                <td className="px-4 py-3 text-inkMuted">{p.request || "—"}</td>
                <td className="px-4 py-3 text-inkMuted">
                  {p.requested_at ? new Date(p.requested_at).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) : "—"}
                </td>
                <td className="px-4 py-3"><StatusBadge status={p.status} /></td>
              </tr>
            ))}
            {list.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-inkSubtle">Nothing in progress. Requests you make from your Inbox show here until staff fulfil them.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
