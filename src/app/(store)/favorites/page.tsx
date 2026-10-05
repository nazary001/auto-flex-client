import type { Metadata } from "next";
import { FavoritesView } from "@/app/(store)/favorites/FavoritesView";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";

export const metadata: Metadata = {
  title: "Обране",
  description: "Збережені автозапчастини в AutoFlex: ваш список обраного, щоб швидко повернутися до потрібних товарів.",
  alternates: { canonical: "/favorites" },
  robots: { index: false, follow: false },
};

export default function FavoritesPage() {
  return (
    <div className="container-page py-6 pb-24 lg:py-10 lg:pb-14">
      <Breadcrumbs items={[{ label: "Обране" }]} />
      <FavoritesView />
    </div>
  );
}
