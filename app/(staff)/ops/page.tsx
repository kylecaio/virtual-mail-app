import { requireStaff } from "@/lib/auth";
export default async function OpsHome() {
  const p = await requireStaff();
  return (
    <div>
      <h1 className="font-serif text-2xl font-semibold text-ink">Operations</h1>
      <p className="mt-2 text-inkMuted">Staff view for {p.email}. Intake (Phase 3) and ops queues (Phase 4) land here.</p>
    </div>
  );
}
