import { requireStaff } from "@/lib/auth";
import { AppShell } from "@/lib/ui/AppShell";
export default async function StaffLayout({ children }: { children: React.ReactNode }) {
  const profile = await requireStaff();
  return <AppShell profile={profile}>{children}</AppShell>;
}
