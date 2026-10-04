import { makes, models } from "@/data/makes";
import { products } from "@/data/products";
import type { Review } from "@/lib/types";

/*
 * Deterministic customer reviews. About 45% of products get 1–4 short reviews;
 * review ratings cluster around the product's aggregate rating, and dates fall
 * between the product's createdAt and the fixed catalog date 2026-10-01.
 */

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rng = mulberry32(0x12a7b9c3);
const rnd = () => rng();
const randInt = (min: number, max: number) => min + Math.floor(rnd() * (max - min + 1));
const pick = <T,>(arr: T[]): T => arr[Math.floor(rnd() * arr.length)];
const chance = (p: number) => rnd() < p;
function weightedPick<T>(items: T[], weights: number[]): T {
  const total = weights.reduce((a, b) => a + b, 0);
  let r = rnd() * total;
  for (let i = 0; i < items.length; i++) {
    r -= weights[i];
    if (r < 0) return items[i];
  }
  return items[items.length - 1];
}

const CATALOG_MS = Date.UTC(2026, 9, 1);
const DAY = 86_400_000;
const isoDate = (ms: number) => new Date(ms).toISOString().slice(0, 10);

const makeById = new Map(makes.map((m) => [m.id, m]));
const modelById = new Map(models.map((m) => [m.id, m]));
const popularModelIds = [
  "volkswagen-golf-vii", "skoda-octavia-a7", "toyota-corolla-e170", "renault-logan-i",
  "ford-focus-iii", "bmw-3-f30", "hyundai-tucson-lm", "kia-sportage-sl",
];

function vehicleLabel(makeId: string, modelId: string): string {
  const make = makeById.get(makeId);
  const model = modelById.get(modelId);
  if (!make || !model) return "";
  return `${make.name} ${model.name}`;
}

const firstNames = [
  "Олег", "Андрій", "Сергій", "Володимир", "Ігор", "Максим", "Роман", "Юрій",
  "Віталій", "Дмитро", "Богдан", "Тарас", "Павло", "Микола", "Олександр", "Вадим",
  "Руслан", "Артем", "Денис", "Василь", "Петро", "Назар", "Євген", "Костянтин",
  "Оксана", "Ірина", "Наталія", "Тетяна", "Марія", "Ольга", "Юлія", "Світлана", "Катерина",
];
const lastInitials = ["К.", "П.", "С.", "М.", "Т.", "В.", "Б.", "Л.", "Г.", "Р.", "Ш.", "Д.", "Н.", "Ф.", "З.", "Ковальчук", "Мельник", "Бондаренко", "Ткаченко", "Шевченко"];

// text pools by star tier; {car} is replaced or dropped
const reviews5 = [
  "Стала як рідна, сіла без доробок. Доставка за два дні, пакування надійне.",
  "Якість відповідає ціні, усе підійшло ідеально. Рекомендую.",
  "Замовляв на {car} — повний збіг із оригіналом, менеджер допоміг звірити за VIN.",
  "Все прийшло вчасно й добре запаковане. Поставив — працює без нарікань.",
  "Беру вже не вперше, оригінальна якість і адекватна ціна.",
  "Підійшло з першого разу, артикул збігся. Задоволений покупкою.",
  "Швидка відправка Новою поштою, товар оригінальний. Дякую за підбір.",
];
const reviews4 = [
  "Загалом задоволений, працює добре. Пакування могло б бути щільнішим.",
  "Деталь якісна, підійшла на {car}. Доставка трохи затрималась, але не критично.",
  "Нормально, стало на місце. Трохи довше чекав відправки, ніж очікував.",
  "Товар відповідає опису. Поки все добре, подивимось на ресурс.",
  "Усе ок, за свої гроші гідний варіант. Коробка прийшла трохи пом'ята.",
  "Підійшло, претензій до якості немає. Інструкції в комплекті не було.",
];
const reviews3 = [
  "Деталь робоча, але довелося трохи підганяти під {car}.",
  "За ці гроші прийнятно, хоча очікував кращого виконання.",
  "Працює, проте кріплення сиділо не дуже щільно. Поживемо — побачимо.",
  "Отримав вчасно, якість середня. Для бюджетного ремонту підійде.",
  "Загалом нормально, але довелось звертатись за консультацією щодо сумісності.",
];

function reviewText(rating: number, car: string): string {
  const pool = rating >= 5 ? reviews5 : rating === 4 ? reviews4 : reviews3;
  const t = pick(pool);
  if (t.includes("{car}")) {
    return car ? t.replace(/\{car\}/g, car) : t.replace(/ на \{car\}| під \{car\}/g, "").replace(/\{car\}/g, "авто");
  }
  return t;
}

/** A whole-star rating within 1 of the product's aggregate, weighted toward it. */
function reviewRating(rating: number): number {
  const lo = Math.max(3, Math.ceil(rating - 1));
  const hi = Math.min(5, Math.floor(rating + 1));
  const cands: number[] = [];
  const weights: number[] = [];
  for (let r = lo; r <= hi; r++) {
    cands.push(r);
    weights.push(1 / (1 + Math.abs(r - rating)));
  }
  return cands.length ? weightedPick(cands, weights) : Math.round(rating);
}

function buildReviews(): Review[] {
  const out: Review[] = [];
  for (const p of products) {
    if (p.reviewsCount < 1) continue;
    // ~45% overall (≈60% of the ~75% that have any reviews)
    if (!chance(0.6)) continue;

    const objects = Math.min(p.reviewsCount, randInt(1, 4));
    const createdMs = Date.parse(p.createdAt);
    const daysAvail = Math.max(1, Math.floor((CATALOG_MS - createdMs) / DAY));

    for (let i = 0; i < objects; i++) {
      // car: prefer one of the product's fitments; occasionally a popular model for universal parts
      let car: string | undefined;
      if (p.fitment.length && chance(0.7)) {
        const f = pick(p.fitment);
        car = vehicleLabel(f.makeId, f.modelId);
      } else if (p.universal && chance(0.3)) {
        const id = pick(popularModelIds);
        const m = modelById.get(id);
        if (m) car = vehicleLabel(m.makeId, id);
      }

      const rating = reviewRating(p.rating);
      const dayOffset = randInt(0, Math.max(0, daysAvail - 1));
      const date = isoDate(createdMs + dayOffset * DAY);
      const author = `${pick(firstNames)} ${pick(lastInitials)}`;

      out.push({
        id: `${p.id}-r${i + 1}`,
        productId: p.id,
        author,
        rating,
        date,
        text: reviewText(rating, car ?? ""),
        ...(car ? { car } : {}),
      });
    }
  }
  return out;
}

export const reviews: Review[] = buildReviews();
