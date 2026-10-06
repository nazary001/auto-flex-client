import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { Exo_2, Inter } from "next/font/google";
import { site } from "@/lib/site";
import "./globals.css";

/*
 * Root layout shared by the storefront `(store)` and the back office `(admin)`:
 * only the document shell, fonts and base metadata live here. The storefront
 * chrome (header, footer, toasts) is in src/app/(store)/layout.tsx, the admin
 * shell in src/app/(admin)/admin/(shell)/layout.tsx.
 */

// Brandbook typography: Inter for everything, Exo 2 ExtraBold Italic for accents
const inter = Inter({
  subsets: ["latin", "cyrillic"],
  variable: "--font-inter",
  display: "swap",
});

const exo2 = Exo_2({
  subsets: ["latin", "cyrillic"],
  weight: "800",
  style: "italic",
  variable: "--font-exo2",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(site.url),
  title: {
    default: `${site.name} — надійні автозапчастини для вашого авто`,
    template: `%s — ${site.name}`,
  },
  description: site.description,
  applicationName: site.name,
  openGraph: {
    type: "website",
    locale: "uk_UA",
    siteName: site.name,
    title: `${site.name} — надійні автозапчастини для вашого авто`,
    description: site.description,
  },
  formatDetection: { telephone: false },
  // Google Search Console ownership (renders <meta name="google-site-verification">)
  verification: { google: "SkfXqLya5MW5Y8X7aY6cT5jBLne-v37gard_ccI_DTs" },
};

export const viewport: Viewport = {
  themeColor: "#001026",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="uk"
      data-scroll-behavior="smooth"
      className={`${inter.variable} ${exo2.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
