import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import AdminNav from "../AdminNav";
import BroadcastComposer from "./BroadcastComposer";
import BroadcastRow from "./BroadcastRow";

export const dynamic = "force-dynamic";

export default async function BroadcastPage() {
  await requireAdmin();
  const supabase = createClient();
  const { data: broadcasts } = await supabase
    .from("broadcasts")
    .select("id, title, body, audience, is_active, created_at")
    .order("created_at", { ascending: false });

  const list = broadcasts ?? [];
  return (
    <div>
      <h1 className="font-serif text-2xl font-semibold text-ink">Broadcast</h1>
      <p className="mt-1 text-inkMuted">Post an in-app banner to the customer dashboard. Live broadcasts show to the chosen audience; turn one off to retire it.</p>

      <AdminNav />

      <div className="mb-8"><BroadcastComposer /></div>

      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-inkSubtle">All broadcasts</h2>
      <div className="space-y-3">
        {list.map((b: any) => <BroadcastRow key={b.id} b={b} />)}
        {list.length === 0 && <div className="rounded-theme border border-border bg-surface px-4 py-8 text-center text-inkSubtle">No broadcasts yet.</div>}
      </div>
    </div>
  );
}
