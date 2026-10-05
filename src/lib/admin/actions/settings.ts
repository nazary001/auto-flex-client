"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { DeliveryMethod, PaymentMethod } from "@/lib/types";
import type { MethodSetting } from "@/lib/admin/types";
import { DELIVERY_METHODS, PAYMENT_METHODS } from "@/lib/admin/labels";
import { saveSettings } from "@/lib/server/db/repos/settings";
import { notifyManagers } from "@/lib/server/notify";
import { ActionError, runAction, type ActionResult } from "./_action";

/*
 * Store settings, grouped by the tabs on /admin/settings. Each action owns one tab and writes a
 * deep-merged patch through `saveSettings`. Checkout changes also refresh the storefront checkout.
 */

const methodSettingSchema = z.object({
  enabled: z.boolean(),
  note: z.string().trim().max(200).optional(),
});

function rebuildMethods<K extends string>(
  keys: readonly K[],
  input: Record<string, { enabled: boolean; note?: string }>,
): Record<K, MethodSetting> {
  const out = {} as Record<K, MethodSetting>;
  for (const key of keys) {
    const value = input[key];
    const enabled = value?.enabled ?? true;
    const note = value?.note?.trim();
    out[key] = note ? { enabled, note } : { enabled };
  }
  return out;
}

const checkoutSchema = z.object({
  delivery: z.record(z.string(), methodSettingSchema),
  payment: z.record(z.string(), methodSettingSchema),
});

export async function saveCheckoutSettingsAction(input: unknown): Promise<ActionResult> {
  return runAction({
    permission: "settings:write",
    schema: checkoutSchema,
    input,
    run: async (data, ctx) => {
      const delivery = rebuildMethods<DeliveryMethod>(DELIVERY_METHODS, data.delivery);
      const payment = rebuildMethods<PaymentMethod>(PAYMENT_METHODS, data.payment);
      await saveSettings(ctx.db, { checkout: { delivery, payment } });
      const disabledDelivery = DELIVERY_METHODS.filter((m) => !delivery[m].enabled).length;
      const disabledPayment = PAYMENT_METHODS.filter((m) => !payment[m].enabled).length;
      await ctx.audit({
        action: "settings.checkout",
        entity: "settings",
        entityId: "store",
        summary: "Оновлено способи доставки та оплати",
        data: { disabledDelivery, disabledPayment },
      });
      revalidatePath("/admin/settings");
      revalidatePath("/checkout");
      revalidatePath("/", "layout");
      return undefined;
    },
  });
}

const orderSettingsSchema = z.object({
  defaultMarkupPercent: z.coerce.number().min(0).max(500),
  lowMarginPercent: z.coerce.number().min(0).max(100),
  staleNewHours: z.coerce.number().int().min(1).max(240),
  staleSourcingDays: z.coerce.number().int().min(1).max(120),
  staleTransitDays: z.coerce.number().int().min(1).max(120),
});

export async function saveOrderSettingsAction(input: unknown): Promise<ActionResult> {
  return runAction({
    permission: "settings:write",
    schema: orderSettingsSchema,
    input,
    run: async (data, ctx) => {
      await saveSettings(ctx.db, {
        orders: {
          defaultMarkupPercent: Math.round(data.defaultMarkupPercent),
          lowMarginPercent: Math.round(data.lowMarginPercent),
          staleNewHours: data.staleNewHours,
          staleSourcingDays: data.staleSourcingDays,
          staleTransitDays: data.staleTransitDays,
        },
      });
      await ctx.audit({
        action: "settings.orders",
        entity: "settings",
        entityId: "store",
        summary: "Оновлено параметри замовлень",
        data,
      });
      revalidatePath("/admin/settings");
      revalidatePath("/admin");
      return undefined;
    },
  });
}

const notificationSchema = z.object({
  telegramNewOrder: z.boolean(),
  telegramNewRequest: z.boolean(),
});

export async function saveNotificationSettingsAction(input: unknown): Promise<ActionResult> {
  return runAction({
    permission: "settings:write",
    schema: notificationSchema,
    input,
    run: async (data, ctx) => {
      await saveSettings(ctx.db, { notifications: data });
      await ctx.audit({
        action: "settings.notifications",
        entity: "settings",
        entityId: "store",
        summary: "Оновлено налаштування сповіщень",
        data,
      });
      revalidatePath("/admin/settings");
      return undefined;
    },
  });
}

const novaPoshtaSchema = z.object({
  change: z.boolean(),
  apiKey: z.string().trim().max(200).optional(),
});

export async function saveNovaPoshtaSettingsAction(input: unknown): Promise<ActionResult> {
  return runAction({
    permission: "settings:write",
    schema: novaPoshtaSchema,
    input,
    run: async (data, ctx) => {
      if (!data.change) return undefined;
      const apiKey = data.apiKey && data.apiKey.length > 0 ? data.apiKey : undefined;
      await saveSettings(ctx.db, { novaPoshta: apiKey ? { apiKey } : {} });
      await ctx.audit({
        action: "settings.novaposhta",
        entity: "settings",
        entityId: "store",
        summary: apiKey ? "Оновлено ключ API Нової Пошти" : "Видалено ключ API Нової Пошти",
      });
      revalidatePath("/admin/settings");
      return undefined;
    },
  });
}

const templateSchema = z.object({
  id: z.string().trim().min(1).max(60),
  name: z.string().trim().min(1, "Вкажіть назву шаблону.").max(80),
  body: z.string().trim().min(1, "Додайте текст шаблону.").max(2000),
});

const templatesSchema = z.object({ templates: z.array(templateSchema).max(50) });

export async function saveTemplatesAction(input: unknown): Promise<ActionResult> {
  return runAction({
    permission: "settings:write",
    schema: templatesSchema,
    input,
    run: async (data, ctx) => {
      const seen = new Set<string>();
      const templates = data.templates.map((template) => {
        let id = template.id;
        while (seen.has(id)) id = `${template.id}-${seen.size}`;
        seen.add(id);
        return { id, name: template.name, body: template.body };
      });
      await saveSettings(ctx.db, { templates });
      await ctx.audit({
        action: "settings.templates",
        entity: "settings",
        entityId: "store",
        summary: `Оновлено шаблони повідомлень (${templates.length})`,
      });
      revalidatePath("/admin/settings");
      return undefined;
    },
  });
}

export async function sendTestNotificationAction(input: unknown): Promise<ActionResult<{ delivered: boolean }>> {
  return runAction({
    permission: "settings:write",
    schema: z.object({}),
    input,
    run: async (_data, ctx) => {
      let delivered: boolean;
      try {
        delivered = await notifyManagers(
          "AutoFlex · тестове повідомлення.\nЯкщо ви це бачите, канал сповіщень налаштовано правильно.",
          { test: true, at: new Date().toISOString() },
        );
      } catch {
        throw new ActionError("Канал сповіщень не відповів. Перевірте токен бота або URL вебхука.");
      }
      await ctx.audit({
        action: "settings.test",
        entity: "settings",
        entityId: "store",
        summary: delivered ? "Надіслано тестове сповіщення" : "Тест сповіщень: жоден канал не налаштовано",
      });
      return { delivered };
    },
  });
}
