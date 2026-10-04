import type { ReactNode } from "react";
import { InfoBreadcrumbs } from "@/components/info/InfoBreadcrumbs";
import { InfoNav } from "@/components/info/InfoNav";

/**
 * Shared chrome for the information pages: breadcrumbs, a sticky grouped side
 * navigation (a horizontal scroller on phones) and a comfortable reading column.
 */
export default function InfoLayout({ children }: { children: ReactNode }) {
  return (
    <div className="container-page py-6 lg:py-10">
      <div className="mx-auto max-w-5xl">
        <InfoBreadcrumbs />
        <div className="mt-5 grid gap-x-12 gap-y-6 lg:mt-7 lg:grid-cols-[13.5rem_minmax(0,1fr)]">
          <InfoNav />
          <div className="min-w-0">{children}</div>
        </div>
      </div>
    </div>
  );
}
