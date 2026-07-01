import Link from "next/link";
import { requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function OpsHome() {
  const p = await requireStaff();
  const supabase = createClient();
  const { count } = await supabase
    .from("mail_pieces")
    .select("serial", { count: "exact", head: true })
    .eq("status", "Pending Verification");

  return (
    <div>
      <h1 className="font-serif text-2xl font-semibold text-ink">Operations</h1>
      <p className="mt-2 text-inkMuted">Signed in as {p.email}.</p>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <Link href="/ops/intake"
          className="rounded-theme border border-border bg-surface p-5 transition hover:border-borderStrong hover:shadow-sm">
          <div className="font-medium text-ink">Intake →</div>
          <p className="mt-1 text-sm text-inkMuted">Photograph and log a new piece of mail.</p>
        </Link>
        <div className="rounded-theme border border-border bg-surface p-5">
          <div className="font-medium text-ink">Pending verification</div>
          <p className="mt-1 text-3xl font-semibold text-accent">{count ?? 0}</p>
          <p className="text-sm text-inkSubtle">pieces awaiting a customer match (Phase 4).</p>
        </div>
      </div>
    </div>
  );
}
