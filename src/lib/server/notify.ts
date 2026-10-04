/*
 * Delivery of orders and callback requests to the store managers.
 *
 * Channels (configure at least one in production, see .env.example):
 *   TELEGRAM_BOT_TOKEN + TELEGRAM_CHAT_ID — message to a Telegram chat
 *   ORDER_WEBHOOK_URL                     — JSON POST to a CRM / automation webhook
 *
 * Without a channel the message is printed to the server log in development,
 * and the request FAILS in production so that no order is silently lost.
 */

const TELEGRAM_LIMIT = 4000;

async function sendTelegram(token: string, chatId: string, text: string): Promise<void> {
  const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text: text.length > TELEGRAM_LIMIT ? `${text.slice(0, TELEGRAM_LIMIT)}…` : text,
      disable_web_page_preview: true,
    }),
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) throw new Error(`Telegram API responded with ${response.status}`);
}

async function sendWebhook(url: string, payload: unknown): Promise<void> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) throw new Error(`Webhook responded with ${response.status}`);
}

/**
 * @param text human-readable message (Telegram)
 * @param data structured copy of the same event (webhook)
 * @throws when no channel accepted the message
 */
export async function notifyManagers(text: string, data: Record<string, unknown>): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  const webhook = process.env.ORDER_WEBHOOK_URL;

  const deliveries: Promise<void>[] = [];
  if (token && chatId) deliveries.push(sendTelegram(token, chatId, text));
  if (webhook) deliveries.push(sendWebhook(webhook, { text, ...data }));

  if (deliveries.length === 0) {
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        "No notification channel is configured: set TELEGRAM_BOT_TOKEN + TELEGRAM_CHAT_ID or ORDER_WEBHOOK_URL",
      );
    }
    console.info(`[AutoFlex] Канал сповіщень не налаштовано — повідомлення для менеджера:\n${text}\n`);
    return;
  }

  const results = await Promise.allSettled(deliveries);
  const failures = results.filter((r) => r.status === "rejected");
  failures.forEach((failure) => console.error("[AutoFlex] Канал сповіщень не спрацював:", failure.reason));
  if (failures.length === results.length) throw new Error("Every notification channel failed");
}

/** Trims, collapses whitespace and caps the length of user-supplied text */
export function clean(value: unknown, maxLength: number): string {
  if (typeof value !== "string") return "";
  return value.replace(/\s+/g, " ").trim().slice(0, maxLength);
}
