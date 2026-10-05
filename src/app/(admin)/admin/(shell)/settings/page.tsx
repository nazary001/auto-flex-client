import type { Metadata } from "next";
import { Alert, PageHeader } from "@/components/admin/ui";
import { Tabs } from "@/components/ui/Tabs";
import { CheckoutSettingsForm } from "@/components/admin/settings/CheckoutSettingsForm";
import { NotificationSettingsForm } from "@/components/admin/settings/NotificationSettingsForm";
import { NovaPoshtaSettingsForm } from "@/components/admin/settings/NovaPoshtaSettingsForm";
import { OrderSettingsForm } from "@/components/admin/settings/OrderSettingsForm";
import { TemplatesForm } from "@/components/admin/settings/TemplatesForm";
import { can } from "@/lib/admin/permissions";
import { requireUser } from "@/lib/server/auth/dal";
import { getDb } from "@/lib/server/db/client";
import { getSettings } from "@/lib/server/db/repos/settings";
import { configuredChannels } from "@/lib/server/notify";

export const metadata: Metadata = { title: "Налаштування" };

export default async function SettingsPage() {
  const user = await requireUser("settings:read");
  const db = await getDb();
  const settings = await getSettings(db);
  const channels = configuredChannels();
  const canWrite = can(user, "settings:write");

  const items = [
    { id: "checkout", label: "Оформлення", content: <CheckoutSettingsForm checkout={settings.checkout} /> },
    { id: "orders", label: "Замовлення", content: <OrderSettingsForm orders={settings.orders} /> },
    {
      id: "notifications",
      label: "Сповіщення",
      content: <NotificationSettingsForm notifications={settings.notifications} channels={channels} />,
    },
    {
      id: "novaposhta",
      label: "Нова Пошта",
      content: <NovaPoshtaSettingsForm hasKey={Boolean(settings.novaPoshta.apiKey)} />,
    },
    { id: "templates", label: "Шаблони повідомлень", content: <TemplatesForm templates={settings.templates} /> },
  ];

  return (
    <div>
      <PageHeader title="Налаштування" description="Оформлення замовлень, параметри роботи, сповіщення та шаблони." />
      {!canWrite && (
        <Alert tone="info" className="mb-4">
          Змінювати налаштування може лише власник магазину. Ви маєте доступ тільки для перегляду.
        </Alert>
      )}
      <Tabs items={items} />
    </div>
  );
}
