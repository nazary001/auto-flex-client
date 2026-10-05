import type { Metadata } from "next";
import { CartView } from "@/components/checkout/CartView";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";

export const metadata: Metadata = {
  title: "Кошик",
  description:
    "Ваш кошик в AutoFlex: перевірте обрані автозапчастини, кількість і суму, після чого переходьте до оформлення замовлення.",
  alternates: { canonical: "/cart" },
  robots: { index: false, follow: false },
};

export default function CartPage() {
  return (
    <div className="container-page py-6 pb-24 lg:py-10 lg:pb-14">
      <Breadcrumbs items={[{ label: "Кошик" }]} />
      <CartView />
    </div>
  );
}
