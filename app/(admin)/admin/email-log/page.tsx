import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import AdminNav from "../AdminNav";
import EmailLogRow from "./EmailLogRow";

export const dynamic = "force-dynamic";

const th = "px-3 py-2 text-left text-xs font-medium uppercase tracking-wide text-inkSubtle";

export default async function EmailLogPage() {
  await requireAdmin();
  const supabase = createClient();

  const { data: rows } = await supabase
    .from("email_log")
    .select("id, created_at, event, recipient, status, provider_id, error")
    .order("created_at", { ascending: false })
    .limit(200);

  const list = (rows ?? []) as any[];
  const failed = list.filter((r) => r.status === "failed").length;

  return (
    <div>
      <h1 className="font-serif text-2xl font-semibold text-ink">Email log</h1>
      <p className="mt-1 text-inkMuted">
        Every notification send, newest first. Showing {list.length}
        {failed > 0 ? ` · ${failed} failed` : ""}. Failed or skipped sends can be resent.
      </p>

      <AdminNav />

      <div className="overflow-x-auto rounded-theme border border-border">
        <table className="w-full text-sm">
          <thead className="bg-surfaceAlt"><tr>
            <th className={th}>When</th><th className={th}>Event</th><th className={th}>Recipient</th>
            <th className={th}>Status</th><th className={th}>Error</th><th className={th}>Action</th>
          </tr></thead>
          <tbody className="bg-surface">
            {list.map((r) => <EmailLogRow key={r.id} row={r} />)}
            {list.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-inkSubtle">No emails sent yet. Notification sends will appear here.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
