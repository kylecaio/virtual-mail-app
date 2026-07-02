"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/pricing", label: "Pricing" },
  { href: "/admin/operators", label: "Operators" },
  { href: "/admin/reports", label: "Reports" },
  { href: "/admin/billing", label: "Billing" },
  { href: "/admin/broadcast", label: "Broadcast" },
  { href: "/admin/email-log", label: "Email log" },
  { href: "/admin/audit", label: "Audit log" },
];

export default function AdminNav() {
  const pathname = usePathname();
  return (
    <nav className="mb-6 flex flex-wrap gap-1 border-b border-border">
      {TABS.map((t) => {
        const active = t.href === "/admin" ? pathname === t.href : pathname.startsWith(t.href);
        return (
          <Link
            key={t.href}
            href={t.href}
            className={
              "-mb-px rounded-t-theme px-3 py-2 text-sm font-medium " +
              (active ? "border-b-2 border-accent text-accent" : "text-inkMuted hover:text-ink")
            }
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
