import type { Metadata } from "next";
import { Info } from "lucide-react";
import { AccountView } from "@/components/account/AccountView";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";

export const metadata: Metadata = {
  title: "Кабінет",
  description: "Особистий кабінет AutoFlex: ваші замовлення, контактні дані для оформлення та обране авто.",
  alternates: { canonical: "/account" },
  robots: { index: false, follow: false },
};

export default function AccountPage() {
  return (
    <div className="container-page py-6 pb-24 lg:py-10 lg:pb-14">
      <Breadcrumbs items={[{ label: "Кабінет" }]} />
      <h1 className="page-title mt-4">Особистий кабінет</h1>
      <p className="mt-3 flex max-w-2xl items-start gap-2 rounded-card border border-line-soft bg-mist-soft px-4 py-3 text-sm text-ink-2">
        <Info aria-hidden className="mt-0.5 size-4 shrink-0 text-brand-700" strokeWidth={1.75} />
        <span>
          Окремого акаунта поки немає: замовлення, контактні дані та обране авто зберігаються локально в цьому браузері
          на цьому пристрої. На іншому пристрої вони не відображатимуться.
        </span>
      </p>
      <AccountView />
    </div>
  );
}
