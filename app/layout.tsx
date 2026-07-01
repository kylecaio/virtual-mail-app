import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "BIG Oakland · Virtual Mail",
  description: "Virtual mailbox & CMRA services — 123 Broadway, Oakland, CA 94607",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
