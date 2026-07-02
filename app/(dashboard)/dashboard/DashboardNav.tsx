"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/dashboard", label: "Inbox" },
  { href: "/dashboard/in-progress", label: "In progress" },
  { href: "/dashboard/archive", label: "Archive" },
  { href: "/dashboard/billing", label: "Billing" },
  { href: "/dashboard/settings", label: "Settings" },
];

export default function DashboardNav() {
  const pathname = usePathname();
  return (
    <nav className="mb-6 flex flex-wrap gap-1 border-b border-border">
      {TABS.map((t) => {
        const active = pathname === t.href;
        return (
          <Link
            key={t.href}
            href={t.href}
            className={
              "-mb-px rounded-t-theme px-3 py-2 text-sm font-medium " +
              (active
                ? "border-b-2 border-accent text-accent"
                : "text-inkMuted hover:text-ink")
            }
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
