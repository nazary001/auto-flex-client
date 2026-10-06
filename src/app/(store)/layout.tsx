import type { ReactNode } from "react";
import { GoogleTagManager } from "@next/third-parties/google";
import { Footer } from "@/components/layout/Footer";
import { Header } from "@/components/layout/Header";
import { PageTransition } from "@/components/layout/PageTransition";
import { Toaster } from "@/components/ui/Toaster";

/** Storefront chrome: skip link, header with the catalog menu, page transition, footer and toasts. */
export default async function StoreLayout({ children }: { children: ReactNode }) {
  return (
    <>
      {/* Google Tag Manager for the storefront only (script + noscript iframe); the back office stays untracked */}
      <GoogleTagManager gtmId="GTM-NCDVJCN6" />
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[100] focus:rounded-btn focus:bg-white focus:px-4 focus:py-2.5 focus:text-sm focus:font-semibold focus:text-brand-700 focus:shadow-pop"
      >
        Перейти до вмісту
      </a>
      <Header />
      <main id="main" className="flex-1">
        <PageTransition>{children}</PageTransition>
      </main>
      <Footer />
      <Toaster />
    </>
  );
}
