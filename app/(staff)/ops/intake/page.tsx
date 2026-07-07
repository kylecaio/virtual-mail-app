import { requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import IntakeForm from "./IntakeForm";
import EnvelopeThumb from "./EnvelopeThumb";

export const dynamic = "force-dynamic";

function fmt(ts: string) {
  return new Date(ts).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

export default async function IntakePage() {
  await requireStaff();
  const supabase = createClient();
  const { data: pieces } = await supabase
    .from("mail_pieces")
    .select("serial, sender, type, received_at, envelope_image, extraction")
    .eq("status", "Pending Verification")
    .order("received_at", { ascending: false })
    .limit(25);

  // Sign envelope photos for viewing (private bucket; page is staff-gated).
  const signed: Record<string, string> = {};
  const paths = (pieces ?? []).map((p: any) => p.envelope_image).filter(Boolean) as string[];
  if (paths.length) {
    try {
      const admin = createAdminClient();
      const { data: sig } = await admin.storage.from("envelope-photos").createSignedUrls(paths, 3600);
      for (const s of sig ?? []) {
        if (s.path && s.signedUrl) signed[s.path] = s.signedUrl;
      }
    } catch {
      /* if signing is unavailable, thumbnails degrade to "—" */
    }
  }

  return (
    <div>
      <div className="mb-6">
        <a href="/ops" className="text-sm text-accent hover:text-accentHover">← Ops</a>
        <h1 className="mt-1 font-serif text-2xl font-semibold text-ink">Intake</h1>
        <p className="mt-1 text-inkMuted">Photograph a piece, log the basics, and it enters the verification queue.</p>
      </div>

      <IntakeForm />

      <h2 className="mt-10 text-sm font-semibold uppercase tracking-wide text-inkSubtle">
        Pending verification ({pieces?.length ?? 0})
      </h2>
      <div className="mt-3 overflow-hidden rounded-theme border border-border">
        <table className="w-full text-sm">
          <thead className="bg-surfaceAlt text-left text-inkMuted">
            <tr>
              <th className="px-4 py-2 font-medium">Serial</th>
              <th className="px-4 py-2 font-medium">Sender</th>
              <th className="px-4 py-2 font-medium">Type</th>
              <th className="px-4 py-2 font-medium">Box guess</th>
              <th className="px-4 py-2 font-medium">Photo</th>
              <th className="px-4 py-2 font-medium">Received</th>
            </tr>
          </thead>
          <tbody className="bg-surface">
            {(pieces ?? []).map((p: any) => (
              <tr key={p.serial} className="border-t border-border">
                <td className="px-4 py-2 font-mono text-ink">#{p.serial}</td>
                <td className="px-4 py-2 text-inkMuted">{p.sender || "—"}</td>
                <td className="px-4 py-2 text-inkMuted">{p.type || "—"}</td>
                <td className="px-4 py-2 text-inkMuted">{p.extraction?.boxGuess ?? "—"}</td>
                <td className="px-4 py-2 text-inkMuted">
                  <EnvelopeThumb url={p.envelope_image ? (signed[p.envelope_image] ?? null) : null} serial={p.serial} />
                </td>
                <td className="px-4 py-2 text-inkSubtle">{fmt(p.received_at)}</td>
              </tr>
            ))}
            {(!pieces || pieces.length === 0) && (
              <tr><td colSpan={6} className="px-4 py-6 text-center text-inkSubtle">No pieces awaiting verification.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
