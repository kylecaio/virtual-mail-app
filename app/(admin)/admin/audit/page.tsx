import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import AdminNav from "../AdminNav";

export const dynamic = "force-dynamic";

const th = "px-3 py-2 text-left text-xs font-medium uppercase tracking-wide text-inkSubtle";

const ACTION_LABEL: Record<string, string> = {
  "pricing.plan.update": "Plan updated",
  "pricing.rule.update": "Pricing rule updated",
  "pricing.margin.update": "Carrier margin updated",
  "operator.grant.add": "Access granted",
  "operator.grant.remove": "Access removed",
  "operator.roster.upsert": "Roster updated",
  "broadcast.create": "Broadcast posted",
  "broadcast.update": "Broadcast updated",
};

function summarize(detail: any): string {
  if (!detail || typeof detail !== "object") return "";
  if (detail.service_type) return String(detail.service_type);
  if (detail.email) return String(detail.email);
  if (detail.carrier) return `${detail.carrier} ${detail.service_type ?? ""}`.trim();
  if (detail.title) return String(detail.title);
  if (detail.after?.name) return String(detail.after.name);
  return "";
}

export default async function AuditPage() {
  await requireAdmin();
  const supabase = createClient();

  const { data: rows } = await supabase
    .from("audit_log")
    .select("id, actor, action, entity, entity_id, detail, created_at")
    .order("created_at", { ascending: false })
    .limit(200);

  const list = rows ?? [];
  const actorIds = Array.from(new Set(list.map((r: any) => r.actor).filter(Boolean)));
  let emailById = new Map<string, string>();
  if (actorIds.length) {
    const { data: profs } = await supabase.from("profiles").select("id, email").in("id", actorIds);
    emailById = new Map((profs ?? []).map((p: any) => [p.id, p.email]));
  }

  return (
    <div>
      <h1 className="font-serif text-2xl font-semibold text-ink">Audit log</h1>
      <p className="mt-1 text-inkMuted">Every admin action, newest first. Showing the most recent {list.length}.</p>

      <AdminNav />

      <div className="overflow-x-auto rounded-theme border border-border">
        <table className="w-full text-sm">
          <thead className="bg-surfaceAlt"><tr>
            <th className={th}>When</th><th className={th}>Actor</th><th className={th}>Action</th><th className={th}>Target</th><th className={th}>Detail</th>
          </tr></thead>
          <tbody className="bg-surface">
            {list.map((r: any) => (
              <tr key={r.id} className="border-t border-border align-top">
                <td className="px-3 py-2 whitespace-nowrap text-inkSubtle">{new Date(r.created_at).toLocaleString()}</td>
                <td className="px-3 py-2 text-inkMuted">{r.actor ? (emailById.get(r.actor) ?? r.actor.slice(0, 8)) : "system"}</td>
                <td className="px-3 py-2 text-ink">{ACTION_LABEL[r.action] ?? r.action}</td>
                <td className="px-3 py-2 text-inkMuted">{[r.entity, summarize(r.detail)].filter(Boolean).join(" · ") || "—"}</td>
                <td className="px-3 py-2">
                  {r.detail ? (
                    <details><summary className="cursor-pointer text-xs text-accent">view</summary>
                      <pre className="mt-1 max-w-md overflow-x-auto rounded-theme bg-surfaceAlt p-2 text-[11px] text-ink">{JSON.stringify(r.detail, null, 2)}</pre>
                    </details>
                  ) : "—"}
                </td>
              </tr>
            ))}
            {list.length === 0 && <tr><td colSpan={5} className="px-4 py-8 text-center text-inkSubtle">No audit entries yet. Admin actions (pricing edits, access changes, broadcasts) will appear here.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
