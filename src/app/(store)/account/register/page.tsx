import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthShell } from "@/components/account/AuthShell";
import { RegisterForm } from "@/components/account/RegisterForm";
import { getCurrentAccount, safeAccountNext } from "@/lib/server/account/dal";

export const metadata: Metadata = {
  title: "Реєстрація",
  description: "Створіть акаунт AutoFlex: номер телефону, електронна пошта та пароль.",
  alternates: { canonical: "/account/register" },
  robots: { index: false, follow: false },
};

export default async function RegisterPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  const target = safeAccountNext(next, "");
  if (await getCurrentAccount()) redirect(target || "/account");

  return (
    <AuthShell
      crumb="Реєстрація"
      title="Реєстрація"
      subtitle="Акаунт зберігає ваші замовлення та дані для швидкого оформлення. Входити можна за телефоном або поштою."
    >
      <RegisterForm next={target || undefined} />
    </AuthShell>
  );
}
