import { requireAdmin } from "@/lib/auth";
import { AppShell } from "@/lib/ui/AppShell";
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const profile = await requireAdmin();
  return <AppShell profile={profile}>{children}</AppShell>;
}
