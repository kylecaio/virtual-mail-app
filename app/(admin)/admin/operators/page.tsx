import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import AdminNav from "../AdminNav";
import GrantForm from "./GrantForm";
import GrantRow from "./GrantRow";
import RosterRow from "./RosterRow";

export const dynamic = "force-dynamic";

const th = "px-3 py-2 text-left text-xs font-medium uppercase tracking-wide text-inkSubtle";

export default async function OperatorsPage() {
  const me = await requireAdmin();
  const supabase = createClient();

  const [{ data: grants }, { data: profiles }, { data: operators }] = await Promise.all([
    supabase.from("role_grants").select("email, role, note, created_at").order("created_at", { ascending: true }),
    supabase.from("profiles").select("id, email, full_name, role").in("role", ["staff", "admin"]).order("email"),
    supabase.from("operators").select("id, display_name, active"),
  ]);

  const opMap = new Map((operators ?? []).map((o: any) => [o.id, o]));
  const roster = (profiles ?? []).map((p: any) => {
    const o = opMap.get(p.id);
    return { ...p, display_name: o?.display_name ?? null, active: o?.active ?? null, onRoster: !!o };
  });

  return (
    <div>
      <h1 className="font-serif text-2xl font-semibold text-ink">Operators</h1>
      <p className="mt-1 text-inkMuted">Two layers work together: the <span className="font-medium text-ink">access allowlist</span> (email → role) governs the actual auth role a person gets, and the <span className="font-medium text-ink">staff roster</span> is a display list of active operators tied to real accounts.</p>

      <AdminNav />

      {/* Access grants */}
      <section className="mb-10">
        <h2 className="mb-1 text-sm font-semibold uppercase tracking-wide text-inkSubtle">Access allowlist</h2>
        <p className="mb-3 text-xs text-inkSubtle">Adding a grant applies the role to an existing account immediately, and to new signups automatically. Removing a grant revokes it and downgrades any existing account to customer on save.</p>
        <div className="mb-4"><GrantForm /></div>
        <div className="overflow-x-auto rounded-theme border border-border">
          <table className="w-full text-sm">
            <thead className="bg-surfaceAlt"><tr>
              <th className={th}>Email</th><th className={th}>Role</th><th className={th}>Note</th><th className={th}>Granted</th><th className={th + " text-right"}>Action</th>
            </tr></thead>
            <tbody className="bg-surface">
              {(grants ?? []).map((g: any) => <GrantRow key={g.email} grant={g} selfEmail={me.email} />)}
              {(!grants || grants.length === 0) && <tr><td colSpan={5} className="px-4 py-6 text-center text-inkSubtle">No grants yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      {/* Staff roster */}
      <section>
        <h2 className="mb-1 text-sm font-semibold uppercase tracking-wide text-inkSubtle">Staff roster</h2>
        <p className="mb-3 text-xs text-inkSubtle">Staff/admin accounts that have signed in. Set a display name and toggle active to curate the operator roster.</p>
        <div className="overflow-x-auto rounded-theme border border-border">
          <table className="w-full text-sm">
            <thead className="bg-surfaceAlt"><tr>
              <th className={th}>Account</th><th className={th}>Role</th><th className={th}>Display name</th><th className={th + " text-center"}>Active</th><th className={th + " text-right"}></th>
            </tr></thead>
            <tbody className="bg-surface">
              {roster.map((p: any) => <RosterRow key={p.id} p={p} />)}
              {roster.length === 0 && <tr><td colSpan={5} className="px-4 py-6 text-center text-inkSubtle">No staff accounts yet. Grant access above; the roster fills in once they sign in.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
