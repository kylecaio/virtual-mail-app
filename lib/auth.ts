import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type Role = "customer" | "staff" | "admin";
export type Profile = { id: string; email: string | null; full_name: string | null; role: Role };

export function roleHome(role: Role): string {
  return role === "admin" ? "/admin" : role === "staff" ? "/ops" : "/dashboard";
}

export async function getProfile(): Promise<Profile | null> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase
    .from("profiles")
    .select("id, email, full_name, role")
    .eq("id", user.id)
    .single();
  return (data as Profile) ?? { id: user.id, email: user.email ?? null, full_name: null, role: "customer" };
}

export async function requireUser(): Promise<Profile> {
  const p = await getProfile();
  if (!p) redirect("/login");
  return p;
}

export async function requireStaff(): Promise<Profile> {
  const p = await requireUser();
  if (p.role !== "staff" && p.role !== "admin") redirect(roleHome(p.role));
  return p;
}

export async function requireAdmin(): Promise<Profile> {
  const p = await requireUser();
  if (p.role !== "admin") redirect(roleHome(p.role));
  return p;
}
