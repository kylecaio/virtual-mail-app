import { requireUser } from "@/lib/auth";
import { getMyCustomer } from "@/lib/customer";
import { createClient } from "@/lib/supabase/server";
import { StatusBadge, ARCHIVE_STATUSES } from "@/lib/ui/MailStatus";
import DashboardNav from "../DashboardNav";
import NoMailbox from "../NoMailbox";

export const dynamic = "force-dynamic";

export default async function ArchivePage() {
  const profile = await requireUser();
  const customer = await getMyCustomer();
  if (!customer) {
    return (<div><DashboardNav /><NoMailbox email={profile.email} /></div>);
  }

  const supabase = createClient();
  const { data: pieces } = await supabase
    .from("mail_pieces")
    .select("id, serial, sender, type, status, completed_at, tracking")
    .in("status", ARCHIVE_STATUSES)
    .order("completed_at", { ascending: false, nullsFirst: false });

  const th = "px-4 py-2 text-left font-medium text-inkMuted";
  const list = pieces ?? [];

  return (
    <div>
      <h1 className="mb-6 font-serif text-2xl font-semibold text-ink">Archive</h1>
      <DashboardNav />
      <div className="overflow-hidden rounded-theme border border-border">
        <table className="w-full text-sm">
          <thead className="bg-surfaceAlt">
            <tr>
              <th className={th}>Serial</th>
              <th className={th}>Sender</th>
              <th className={th}>Type</th>
              <th className={th}>Completed</th>
              <th className={th}>Tracking</th>
              <th className={th}>Status</th>
            </tr>
          </thead>
          <tbody className="bg-surface">
            {list.map((p: any) => (
              <tr key={p.id} className="border-t border-border">
                <td className="px-4 py-3 font-mono text-ink">#{p.serial}</td>
                <td className="px-4 py-3 text-inkMuted">{p.sender || "—"}</td>
                <td className="px-4 py-3 text-inkMuted">{p.type || "—"}</td>
                <td className="px-4 py-3 text-inkMuted">
                  {p.completed_at ? new Date(p.completed_at).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) : "—"}
                </td>
                <td className="px-4 py-3 font-mono text-xs text-inkMuted">{p.tracking || "—"}</td>
                <td className="px-4 py-3"><StatusBadge status={p.status} /></td>
              </tr>
            ))}
            {list.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-inkSubtle">No completed items yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
