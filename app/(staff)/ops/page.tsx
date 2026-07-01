import Link from "next/link";
import { requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import VerifyRow from "./VerifyRow";
import ActionRow from "./ActionRow";

export const dynamic = "force-dynamic";

const ACTIONABLE = ["Received", "Scan Requested", "Forward Requested", "Shred Requested", "Recycle Requested", "Pickup Scheduled"];
const EXCEPTIONS = ["Address Correction", "Return to Sender"];

export default async function OpsDashboard() {
  await requireStaff();
  const supabase = createClient();

  const [{ data: verify }, { data: actionable }, { data: exceptions }, { data: customers }] = await Promise.all([
    supabase.from("mail_pieces").select("serial, sender, type, received_at, extraction")
      .eq("status", "Pending Verification").order("received_at", { ascending: true }),
    supabase.from("mail_pieces").select("id, serial, customer_id, sender, type, status, request, customer:customers(box_number, name)")
      .in("status", ACTIONABLE).order("received_at", { ascending: true }),
    supabase.from("mail_pieces").select("serial, sender, status, customer:customers(box_number, name)")
      .in("status", EXCEPTIONS).order("received_at", { ascending: false }),
    supabase.from("customers").select("id, box_number, name, company").order("box_number"),
  ]);

  const th = "px-4 py-2 text-left font-medium text-inkMuted";
  const custList = customers ?? [];

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="font-serif text-2xl font-semibold text-ink">Operations</h1>
          <p className="mt-1 text-inkMuted">Verify incoming mail, fulfil requests, and clear exceptions.</p>
        </div>
        <Link href="/ops/intake" className="rounded-theme bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accentHover">+ Intake</Link>
      </div>

      {/* Verify queue */}
      <section className="mb-10">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-inkSubtle">Verify queue ({verify?.length ?? 0})</h2>
        <p className="mb-3 text-xs text-inkSubtle">Match each piece to a customer, or flag an exception.</p>
        <div className="overflow-hidden rounded-theme border border-border">
          <table className="w-full text-sm">
            <thead className="bg-surfaceAlt"><tr>
              <th className={th}>Serial</th><th className={th}>Sender</th><th className={th}>Type</th>
              <th className={th}>Assign customer</th><th className={th}>Action</th>
            </tr></thead>
            <tbody className="bg-surface">
              {(verify ?? []).map((p: any) => (
                <VerifyRow key={p.serial} piece={p} customers={custList} />
              ))}
              {(!verify || verify.length === 0) && <tr><td colSpan={5} className="px-4 py-6 text-center text-inkSubtle">Nothing to verify.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      {/* Fulfillment queue */}
      <section className="mb-10">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-inkSubtle">To fulfil ({actionable?.length ?? 0})</h2>
        <p className="mb-3 text-xs text-inkSubtle">Verified & requested pieces. Fulfilling writes the status transition and logs the service.</p>
        <div className="overflow-hidden rounded-theme border border-border">
          <table className="w-full text-sm">
            <thead className="bg-surfaceAlt"><tr>
              <th className={th}>Serial</th><th className={th}>Customer</th><th className={th}>Sender</th>
              <th className={th}>Status</th><th className={th}>Fulfil</th>
            </tr></thead>
            <tbody className="bg-surface">
              {(actionable ?? []).map((p: any) => <ActionRow key={p.serial} piece={p} />)}
              {(!actionable || actionable.length === 0) && <tr><td colSpan={5} className="px-4 py-6 text-center text-inkSubtle">Nothing to fulfil.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      {/* Exceptions */}
      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-inkSubtle">Exceptions ({exceptions?.length ?? 0})</h2>
        <div className="mt-3 overflow-hidden rounded-theme border border-border">
          <table className="w-full text-sm">
            <thead className="bg-surfaceAlt"><tr>
              <th className={th}>Serial</th><th className={th}>Sender</th><th className={th}>Customer</th><th className={th}>Status</th>
            </tr></thead>
            <tbody className="bg-surface">
              {(exceptions ?? []).map((p: any) => (
                <tr key={p.serial} className="border-t border-border">
                  <td className="px-4 py-2 font-mono text-ink">#{p.serial}</td>
                  <td className="px-4 py-2 text-inkMuted">{p.sender || "—"}</td>
                  <td className="px-4 py-2 text-inkMuted">{p.customer ? `#${p.customer.box_number} ${p.customer.name}` : "—"}</td>
                  <td className="px-4 py-2"><span className="rounded-theme bg-shred-bg px-2 py-0.5 text-xs" style={{ background: "#F9E3DE", color: "#8A2118" }}>{p.status}</span></td>
                </tr>
              ))}
              {(!exceptions || exceptions.length === 0) && <tr><td colSpan={4} className="px-4 py-6 text-center text-inkSubtle">No exceptions.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
