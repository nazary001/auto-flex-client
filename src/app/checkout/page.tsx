import type { Metadata } from "next";
import { CheckoutForm } from "@/components/checkout/CheckoutForm";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";

export const metadata: Metadata = {
  title: "Оформлення замовлення",
  description:
    "Оформлення замовлення в AutoFlex: контактні дані, доставка Новою Поштою або Укрпоштою, оплата та перевірка сумісності за VIN.",
  alternates: { canonical: "/checkout" },
  robots: { index: false, follow: false },
};

export default function CheckoutPage() {
  return (
    <div className="container-page py-6 pb-24 lg:py-10 lg:pb-14">
      <Breadcrumbs items={[{ label: "Кошик", href: "/cart" }, { label: "Оформлення замовлення" }]} />
      <h1 className="page-title mt-4">Оформлення замовлення</h1>
      <p className="lead mt-2">
        Заповніть дані для доставки — менеджер перевірить наявність і сумісність, після чого підтвердить замовлення.
      </p>
      <CheckoutForm />
    </div>
  );
}
