import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Logo } from "@/components/brand/Logo";
import { LoginScreen } from "@/components/admin/auth/LoginScreen";
import { getCurrentUser } from "@/lib/server/auth/dal";
import { getDb } from "@/lib/server/db/client";
import { countUsers } from "@/lib/server/db/repos/users";

export const metadata: Metadata = { title: "Вхід" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  if (await getCurrentUser()) redirect("/admin");
  const { next } = await searchParams;

  let hasUsers = false;
  try {
    hasUsers = (await countUsers(await getDb())) > 0;
  } catch (error) {
    console.error("[AutoFlex] База даних недоступна на /admin/login", error);
    return (
      <div className="flex min-h-dvh items-center justify-center p-4">
        <div className="w-full max-w-md rounded-card border border-line-soft bg-white p-6 text-center shadow-card">
          <Logo className="mx-auto h-8 w-auto" />
          <h1 className="mt-5 text-lg font-semibold text-ink">База даних недоступна</h1>
          <p className="mt-1.5 text-sm text-ink-3">
            Не вдалося підключитися до бази даних. Перевірте змінну середовища MONGODB_URI і оновіть сторінку.
          </p>
        </div>
      </div>
    );
  }

  return <LoginScreen mode={hasUsers ? "login" : "setup"} next={next} />;
}
