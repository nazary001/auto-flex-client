import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./admin.css";

export const metadata: Metadata = {
  title: {
    default: "Адмінка — AutoFlex",
    template: "%s — Адмінка AutoFlex",
  },
  robots: { index: false, follow: false },
};

/** Root of the back office: the canvas and admin-only styles. Shells live one level deeper. */
export default function AdminLayout({ children }: { children: ReactNode }) {
  return <div className="flex min-h-dvh flex-1 flex-col bg-mist-soft text-ink">{children}</div>;
}
