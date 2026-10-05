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

export async function trackDocument(trackingNumber: string, options: { apiKey?: string; phone?: string } = {}): Promise<TrackingResult> {
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
      signal: AbortSignal.timeout(10000),
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
