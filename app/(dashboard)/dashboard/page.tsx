import { requireUser } from "@/lib/auth";
export default async function DashboardHome() {
  const p = await requireUser();
  return (
    <div>
      <h1 className="font-serif text-2xl font-semibold text-ink">Your mailbox</h1>
      <p className="mt-2 text-inkMuted">Signed in as {p.email}. Inbox, scan / forward / shred / recycle / pickup arrive in Phase 5.</p>
    </div>
  );
}
