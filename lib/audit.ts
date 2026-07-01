import type { SupabaseClient } from "@supabase/supabase-js";

export type AuditEntry = {
  action: string; // e.g. "pricing.plan.update", "operator.grant.add"
  entity?: string; // table / domain, e.g. "plans"
  entity_id?: string | number | null;
  detail?: Record<string, any> | null;
};

// Writes an audit_log row as the current user. RLS lets staff/admin insert
// (policy audit_insert = is_staff()). Best-effort: audit failure never blocks
// the primary action, but the error is surfaced to the caller for logging.
export async function logAudit(supabase: SupabaseClient, entry: AuditEntry) {
  const { data: { user } } = await supabase.auth.getUser();
  const { error } = await supabase.from("audit_log").insert({
    actor: user?.id ?? null,
    action: entry.action,
    entity: entry.entity ?? null,
    entity_id: entry.entity_id != null ? String(entry.entity_id) : null,
    detail: entry.detail ?? null,
  });
  return error;
}
