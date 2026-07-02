// Phase 8a — admin test-send endpoint.
// POST { to } → sends a test email via Resend and writes an email_log row.
// Admin-only (checked here rather than requireAdmin(), which redirects — wrong for an API route).

import { NextResponse } from "next/server";
import { getProfile } from "@/lib/auth";
import { sendTestEmail } from "@/lib/email";

export async function POST(request: Request) {
  const profile = await getProfile();
  if (!profile || profile.role !== "admin") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  let to: unknown;
  try {
    ({ to } = await request.json());
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }
  if (typeof to !== "string" || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(to)) {
    return NextResponse.json({ error: "valid `to` email required" }, { status: 400 });
  }

  const result = await sendTestEmail(to);
  const status = result.ok ? 200 : result.skipped ? 202 : 502;
  return NextResponse.json(result, { status });
}
