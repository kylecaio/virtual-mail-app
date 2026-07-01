import { NextResponse } from "next/server";
import { getProfile, roleHome } from "@/lib/auth";

export async function GET(request: Request) {
  const profile = await getProfile();
  const origin = new URL(request.url).origin;
  if (!profile) return NextResponse.redirect(`${origin}/login`);
  return NextResponse.redirect(`${origin}${roleHome(profile.role)}`);
}
