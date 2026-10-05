import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthShell } from "@/components/account/AuthShell";
import { LoginForm } from "@/components/account/LoginForm";
import { getCurrentAccount, safeAccountNext } from "@/lib/server/account/dal";

export const metadata: Metadata = {
  title: "Вхід до кабінету",
  description: "Увійдіть до особистого кабінету AutoFlex за номером телефону або електронною поштою.",
  alternates: { canonical: "/account/login" },
  robots: { index: false, follow: false },
};

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  const target = safeAccountNext(next, "");
  if (await getCurrentAccount()) redirect(target || "/account");

  return (
    <AuthShell crumb="Вхід" title="Вхід до кабінету" subtitle="Введіть номер телефону або електронну пошту та пароль.">
      <LoginForm next={target || undefined} />
    </AuthShell>
  );
}
