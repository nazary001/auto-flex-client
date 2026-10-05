/*
 * NBU official exchange rates (public JSON). Used to convert the supplier's EUR / USD wholesale
 * prices into UAH cost prices.
 */

export interface Rates {
  EUR: number;
  USD: number;
}

const NBU = "https://bank.gov.ua/NBUStatService/v1/statdirectory/exchange";

async function fetchRate(code: "EUR" | "USD"): Promise<number> {
  const response = await fetch(`${NBU}?valcode=${code}&json`, { signal: AbortSignal.timeout(15_000), cache: "no-store" });
  if (!response.ok) throw new Error(`НБУ відповів ${response.status}`);
  const rows = (await response.json()) as { rate?: number }[];
  const rate = rows[0]?.rate;
  if (typeof rate !== "number" || !(rate > 0)) throw new Error(`НБУ не повернув курс ${code}`);
  return rate;
}

export async function fetchNbuRates(): Promise<Rates> {
  const [EUR, USD] = await Promise.all([fetchRate("EUR"), fetchRate("USD")]);
  return { EUR, USD };
}

export function toUah(amount: number, currency: "EUR" | "USD" | "UAH", rates: Rates): number {
  switch (currency) {
    case "EUR":
      return amount * rates.EUR;
    case "USD":
      return amount * rates.USD;
    default:
      return amount;
  }
}
