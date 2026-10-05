"use client";

import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { ActionButton, Card, Pill, SubmitButton } from "@/components/admin/ui";
import { Checkbox } from "@/components/ui/Field";
import { toast } from "@/lib/store";
import type { ActionResult } from "@/lib/admin/actions/_action";
import type { StoreSettings } from "@/lib/admin/types";
import { saveNotificationSettingsAction, sendTestNotificationAction } from "@/lib/admin/actions/settings";

interface NotificationSettingsFormProps {
  notifications: StoreSettings["notifications"];
  channels: { telegram: boolean; webhook: boolean };
}

export function NotificationSettingsForm({ notifications, channels }: NotificationSettingsFormProps) {
  const router = useRouter();
  const [, formAction] = useActionState<ActionResult | null, FormData>(async (_prev, formData) => {
    const result = await saveNotificationSettingsAction({
      telegramNewOrder: formData.get("telegramNewOrder") === "on",
      telegramNewRequest: formData.get("telegramNewRequest") === "on",
    });
    if (result.ok) {
      toast({ title: "Налаштування збережено" });
      router.refresh();
    } else {
      toast({ title: result.error, tone: "error" });
    }
    return result;
  }, null);

  return (
    <Card
      title="Сповіщення менеджерам"
      description="Нові замовлення та заявки надсилаються у налаштовані канали. Секрети зберігаються у змінних середовища."
    >
      <div className="space-y-6">
        <dl className="grid gap-3 sm:grid-cols-2">
          <ChannelStatus
            name="Telegram"
            configured={channels.telegram}
            env="TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID"
          />
          <ChannelStatus name="Вебхук" configured={channels.webhook} env="ORDER_WEBHOOK_URL" />
        </dl>

        <form action={formAction} className="space-y-3 border-t border-line-soft pt-5">
          <Checkbox
            name="telegramNewOrder"
            label="Сповіщати про нові замовлення"
            defaultChecked={notifications.telegramNewOrder}
          />
          <Checkbox
            name="telegramNewRequest"
            label="Сповіщати про нові заявки"
            defaultChecked={notifications.telegramNewRequest}
          />
          <div className="pt-2">
            <SubmitButton pendingText="Зберігаємо…">Зберегти</SubmitButton>
          </div>
        </form>

        <div className="flex flex-wrap items-center gap-3 border-t border-line-soft pt-5">
          <ActionButton
            action={sendTestNotificationAction.bind(null, {})}
            variant="secondary"
            size="sm"
            refresh={false}
            onSuccess={(data) => {
              const delivered = (data as { delivered: boolean }).delivered;
              toast({
                title: delivered ? "Тестове повідомлення надіслано" : "Жоден канал сповіщень не налаштовано",
                tone: delivered ? "success" : "error",
              });
            }}
          >
            Надіслати тестове повідомлення
          </ActionButton>
          <p className="text-[13px] text-ink-3">Перевірте, що канал приймає повідомлення.</p>
        </div>
      </div>
    </Card>
  );
}

function ChannelStatus({ name, configured, env }: { name: string; configured: boolean; env: string }) {
  return (
    <div className="rounded-card border border-line-soft p-3.5">
      <div className="flex items-center justify-between gap-2">
        <dt className="text-sm font-medium text-ink">{name}</dt>
        <Pill tone={configured ? "green" : "slate"} size="sm">
          {configured ? "налаштовано" : "не налаштовано"}
        </Pill>
      </div>
      <dd className="tabular mt-1.5 text-[12.5px] text-ink-3">{env}</dd>
    </div>
  );
}
