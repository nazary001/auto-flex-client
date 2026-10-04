"use client";

import { usePathname } from "next/navigation";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { getInfoPage } from "@/components/info/pages";

/** Breadcrumbs for the (info) group — «Головна › <current page>», derived from the path. */
export function InfoBreadcrumbs() {
  const pathname = usePathname();
  const page = getInfoPage(pathname);
  return <Breadcrumbs items={[{ label: page?.label ?? "Інформація" }]} />;
}
