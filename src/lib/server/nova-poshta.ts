/*
 * Nova Poshta tracking (public API, works without a key for status lookups; an API key from
 * the business cabinet raises the rate limits and returns more fields).
 */

const ENDPOINT = "https://api.novaposhta.ua/v2.0/json/";

export interface TrackingResult {
  number: string;
  status: string;
  statusCode: string;
  scheduledDeliveryDate?: string;
  recipientDateTime?: string;
  warehouseRecipient?: string;
  citySender?: string;
  cityRecipient?: string;
  /** Parcel handed over to the recipient (status codes 9, 10, 11) */
  delivered: boolean;
  /** Parcel is waiting at the branch / locker (codes 7, 8) */
  awaitingPickup: boolean;
  /** Refused / returning to sender (codes 102, 103, 108) */
  returning: boolean;
}

interface NpDocument {
  Number: string;
  Status: string;
  StatusCode: string;
  ScheduledDeliveryDate?: string;
  RecipientDateTime?: string;
  WarehouseRecipient?: string;
  CitySender?: string;
  CityRecipient?: string;
}

export class TrackingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TrackingError";
  }
}

export function isTrackingNumber(value: string): boolean {
  return /^\d{14}$/.test(value.replace(/\s/g, ""));
}

export async function trackDocument(
  trackingNumber: string,
  options: { apiKey?: string; phone?: string; timeoutMs?: number } = {},
): Promise<TrackingResult> {
  const number = trackingNumber.replace(/\s/g, "");
  if (!isTrackingNumber(number)) throw new TrackingError("Номер ТТН має складатися з 14 цифр.");

  let response: Response;
  try {
    response = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        apiKey: options.apiKey ?? "",
        modelName: "TrackingDocument",
        calledMethod: "getStatusDocuments",
        methodProperties: { Documents: [{ DocumentNumber: number, Phone: options.phone ?? "" }] },
      }),
      signal: AbortSignal.timeout(options.timeoutMs ?? 10000),
    });
  } catch {
    throw new TrackingError("Нова Пошта не відповідає. Спробуйте пізніше.");
  }
  if (!response.ok) throw new TrackingError(`Нова Пошта відповіла з кодом ${response.status}.`);

  const json = (await response.json()) as { success?: boolean; data?: NpDocument[]; errors?: string[] };
  const doc = json.data?.[0];
  if (!json.success || !doc) {
    throw new TrackingError(json.errors?.[0] ?? "Нова Пошта не повернула дані за цим номером.");
  }
  const code = String(doc.StatusCode ?? "");
  return {
    number: doc.Number,
    status: doc.Status,
    statusCode: code,
    scheduledDeliveryDate: doc.ScheduledDeliveryDate || undefined,
    recipientDateTime: doc.RecipientDateTime || undefined,
    warehouseRecipient: doc.WarehouseRecipient || undefined,
    citySender: doc.CitySender || undefined,
    cityRecipient: doc.CityRecipient || undefined,
    delivered: ["9", "10", "11"].includes(code),
    awaitingPickup: ["7", "8"].includes(code),
    returning: ["102", "103", "108"].includes(code),
  };
}

export function trackingUrl(trackingNumber: string): string {
  return `https://novaposhta.ua/tracking/?cargo_number=${encodeURIComponent(trackingNumber.replace(/\s/g, ""))}`;
}

/** Public tracking page of the carrier that handles the parcel */
export function carrierTrackingUrl(carrier: string | undefined, trackingNumber: string): string {
  const number = trackingNumber.replace(/\s/g, "");
  if (carrier === "ukrposhta") return `https://track.ukrposhta.ua/tracking_UA.html?barcode=${encodeURIComponent(number)}`;
  return trackingUrl(number);
}

export type TrackingStage = "label" | "in_transit" | "awaiting_pickup" | "delivered" | "returning" | "unknown";

/** Coarse stage behind a Nova Poshta status code (see «Статуси ТТН» in the API docs) */
export function trackingStage(statusCode?: string): TrackingStage {
  switch (statusCode) {
    case undefined:
    case "":
    case "2":
    case "3":
      return "unknown";
    case "1":
      return "label";
    case "7":
    case "8":
      return "awaiting_pickup";
    case "9":
    case "10":
    case "11":
      return "delivered";
    case "102":
    case "103":
    case "105":
    case "106":
    case "108":
      return "returning";
    default:
      return "in_transit";
  }
}

/** "15-03-2026 14:21:03" → "15.03.2026" (or "15.03.2026, 14:21") */
export function formatNpDate(raw?: string, withTime = false): string | undefined {
  if (!raw) return undefined;
  const m = raw.trim().match(/^(\d{2})-(\d{2})-(\d{4})(?:\s+(\d{2}):(\d{2}))?/);
  if (!m) return raw;
  const date = `${m[1]}.${m[2]}.${m[3]}`;
  return withTime && m[4] ? `${date}, ${m[4]}:${m[5]}` : date;
}
