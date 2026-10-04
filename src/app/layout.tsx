import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { Exo_2, Inter } from "next/font/google";
import { Footer } from "@/components/layout/Footer";
import { Header } from "@/components/layout/Header";
import { Toaster } from "@/components/ui/Toaster";
import { site } from "@/lib/site";
import "./globals.css";

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
};

export const viewport: Viewport = {
  themeColor: "#001026",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="uk" className={`${inter.variable} ${exo2.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[100] focus:rounded-btn focus:bg-white focus:px-4 focus:py-2.5 focus:text-sm focus:font-semibold focus:text-brand-700 focus:shadow-pop"
        >
          Перейти до вмісту
        </a>
        <Header />
        <main id="main" className="flex-1">
          {children}
        </main>
        <Footer />
        <Toaster />
      </body>
    </html>
  );
}
