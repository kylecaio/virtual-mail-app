import { requireUser } from "@/lib/auth";
import { AppShell } from "@/lib/ui/AppShell";
import BroadcastBanner from "@/lib/ui/BroadcastBanner";
export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const profile = await requireUser();
  return (
    <AppShell profile={profile}>
      <BroadcastBanner />
      {children}
    </AppShell>
  );
}
