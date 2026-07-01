import { requireUser } from "@/lib/auth";
import { AppShell } from "@/lib/ui/AppShell";
export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const profile = await requireUser();
  return <AppShell profile={profile}>{children}</AppShell>;
}
