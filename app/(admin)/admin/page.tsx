import { requireAdmin } from "@/lib/auth";
export default async function AdminHome() {
  const p = await requireAdmin();
  return (
    <div>
      <h1 className="font-serif text-2xl font-semibold text-ink">Admin</h1>
      <p className="mt-2 text-inkMuted">Admin-only, confirmed for {p.email}. Pricing editor, operators, reports arrive in Phase 6.</p>
    </div>
  );
}
