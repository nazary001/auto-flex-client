import type { Db } from "mongodb";
import type { DeliveryMethod, PaymentMethod, Product } from "@/lib/types";
import { cols } from "./collections";
import { docToProduct } from "@/lib/server/catalog/product-doc";
import type { CallbackKind } from "@/lib/types";
import type { OfferAvailability, OrderSource, OrderStatus, PurchaseOrderStatus, RequestStatus } from "@/lib/admin/types";
import { SYSTEM_ACTOR } from "@/lib/admin/types";
import { recordAudit } from "./repos/audit";
import { upsertOffers, type OfferInput } from "./repos/offers";
import { addOrderEvent, changeOrderStatus, createOrder, getOrder, updateOrder } from "./repos/orders";
import { createPurchaseOrder, setPurchaseOrderStatus } from "./repos/purchase-orders";
import { createRequest } from "./repos/requests";
import { createReview } from "./repos/reviews";
import { createSupplier } from "./repos/suppliers";
import { saveSettings } from "./repos/settings";

/*
 * Demo data for the back office so that every screen has something to show on first start:
 * suppliers with price lists, customers, two months of orders in every status, purchase
 * orders, requests and reviews awaiting moderation. Deterministic (seeded PRNG) except that
 * dates are relative to "now".
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

const rng = mulberry32(0xa11ce5ed);
const rnd = () => rng();
const randInt = (min: number, max: number) => min + Math.floor(rnd() * (max - min + 1));
const pick = <T,>(arr: readonly T[]): T => arr[Math.floor(rnd() * arr.length)];
const chance = (p: number) => rnd() < p;
function weightedPick<T>(items: readonly T[], weights: readonly number[]): T {
  const total = weights.reduce((a, b) => a + b, 0);
  let r = rnd() * total;
  for (let i = 0; i < items.length; i++) {
    r -= weights[i];
    if (r < 0) return items[i];
  }
  return items[items.length - 1];
}

const hoursAgo = (hours: number) => new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
const daysAgo = (days: number, hourOfDay = randInt(9, 20)) => {
  const d = new Date();
  d.setDate(d.getDate() - days);
  d.setHours(hourOfDay, randInt(0, 59), randInt(0, 59), 0);
  return d.toISOString();
};
const plusHours = (iso: string, hours: number) => new Date(new Date(iso).getTime() + hours * 60 * 60 * 1000).toISOString();

// ── reference data ──────────────────────────────────────────

const SUPPLIERS = [
  {
    id: "sup-elit",
    code: "ELIT",
    name: "ELIT Ukraine",
    contacts: { phone: "+380 44 390 10 10", email: "orders@elit.ua", manager: "Олег", site: "https://elit.ua" },
    leadDays: [1, 2] as [number, number],
    paymentTerms: "Передплата або оплата при отриманні на складі",
    deliveryTerms: "Відправка Новою Поштою щодня до 17:00",
    shipsDirect: true,
    defaultMarkupPercent: 25,
    notes: "Найширший асортимент гальм та фільтрів. Повернення протягом 14 днів без розпакування.",
  },
  {
    id: "sup-intercars",
    code: "IC",
    name: "Inter Cars Ukraine",
    contacts: { phone: "+380 44 594 55 55", email: "b2b@intercars.ua", telegram: "@intercars_ua" },
    leadDays: [1, 3] as [number, number],
    paymentTerms: "Відстрочка 7 днів для партнерів",
    deliveryTerms: "Доставка власним транспортом до відділення НП",
    shipsDirect: false,
    defaultMarkupPercent: 22,
    notes: "Підвіска, ГРМ, оптика. Мінімальне замовлення — 500 ₴.",
  },
  {
    id: "sup-autotechnics",
    code: "AT",
    name: "Автотехнікс",
    contacts: { phone: "+380 67 220 11 22", email: "sale@autotechnics.ua", manager: "Марина" },
    leadDays: [2, 4] as [number, number],
    paymentTerms: "Передплата 100%",
    deliveryTerms: "Відправка НП з Дніпра",
    shipsDirect: true,
    defaultMarkupPercent: 30,
    notes: "Електрика, акумулятори, кузовні деталі.",
  },
  {
    id: "sup-oilmarket",
    code: "OIL",
    name: "OilMarket",
    contacts: { phone: "+380 50 311 77 00", email: "opt@oilmarket.ua" },
    leadDays: [1, 1] as [number, number],
    paymentTerms: "Оплата при отриманні",
    deliveryTerms: "Самовивіз або НП",
    shipsDirect: true,
    defaultMarkupPercent: 18,
    notes: "Оливи, антифризи, автохімія, аксесуари.",
  },
] as const;

const FIRST_NAMES = ["Андрій", "Олексій", "Віктор", "Ірина", "Тарас", "Марія", "Сергій", "Наталія", "Дмитро", "Оксана", "Володимир", "Юлія", "Максим", "Олена", "Роман", "Анна", "Ігор", "Катерина", "Богдан", "Світлана"];
const LAST_NAMES = ["Коваленко", "Шевченко", "Бондаренко", "Ткаченко", "Кравченко", "Олійник", "Мельник", "Поліщук", "Савченко", "Руденко", "Мороз", "Лисенко", "Марченко", "Петренко", "Клименко", "Гриценко", "Павленко", "Литвиненко", "Романенко", "Захарченко"];
const CITIES = ["Київ", "Львів", "Одеса", "Дніпро", "Харків", "Вінниця", "Полтава", "Черкаси", "Житомир", "Тернопіль", "Івано-Франківськ", "Рівне", "Луцьк", "Чернігів", "Суми"];
const OPERATOR_CODES = ["50", "63", "66", "67", "68", "73", "93", "95", "96", "97", "98", "99"];
const CARS = ["Škoda Octavia A7", "VW Golf VII", "Audi A4 B8", "Ford Focus III", "Renault Megane III", "Toyota Corolla E170", "Hyundai Tucson TL", "Kia Sportage QL", "Nissan Qashqai J11", "Opel Astra J"];

const CANCEL_REASONS = ["Покупець передумав", "Не підійшло за сумісністю", "Знайшов дешевше", "Немає в наявності у постачальника", "Не вдалося додзвонитися"];

function phoneNumber(): string {
  return `380${pick(OPERATOR_CODES)}${String(randInt(1000000, 9999999))}`;
}

function ttn(): string {
  return `20450${String(randInt(100000000, 999999999))}`;
}

// ── seed ────────────────────────────────────────────────────

export async function seedDemoData(db: Db): Promise<void> {
  const actor = SYSTEM_ACTOR;
  // Products come from the catalog collection (demo import or a supplier sync)
  const productDocs = await cols(db)
    .products.find({ hidden: false }, { sort: { popularity: -1, _id: 1 }, limit: 3000 })
    .toArray();
  const products: Product[] = productDocs.map(docToProduct);
  const demoOnly = productDocs.every((d) => d.source === "demo");
  const categoryGroup = new Map(products.map((p) => [p.categoryId, p.groupId ?? p.categoryId]));
  const sellable = products.filter((p) => p.stock !== "out_of_stock");
  if (sellable.length === 0) return;

  // Suppliers
  for (const s of SUPPLIERS) {
    await createSupplier(
      db,
      {
        code: s.code,
        name: s.name,
        active: true,
        contacts: { ...s.contacts },
        leadDays: s.leadDays,
        paymentTerms: s.paymentTerms,
        deliveryTerms: s.deliveryTerms,
        shipsDirect: s.shipsDirect,
        defaultMarkupPercent: s.defaultMarkupPercent,
        notes: s.notes,
      },
      { id: s.id },
    );
  }

  // Offers: each supplier specialises in some groups, everyone carries a bit of everything
  const specialities: Record<string, string[]> = {
    "sup-elit": ["halmivna-systema", "filtry", "dvyhun", "okholodzhennia-ta-klimat"],
    "sup-intercars": ["pidviska-ta-rulove", "dvyhun", "transmisiia", "osvitlennia", "vykhlopna-systema"],
    "sup-autotechnics": ["elektryka", "kuzovni-detali", "osvitlennia"],
    "sup-oilmarket": ["olyvy-ta-avtokhimiia", "aksesuary", "filtry"],
  };
  const costByProduct = new Map<string, { supplierId: string; cost: number }>();
  for (const s of demoOnly ? SUPPLIERS : []) {
    const rows: OfferInput[] = [];
    for (const p of products) {
      const group = categoryGroup.get(p.categoryId) ?? "";
      const special = specialities[s.id].includes(group);
      if (!chance(special ? 0.85 : 0.18)) continue;
      const ratio = special ? 0.62 + rnd() * 0.12 : 0.7 + rnd() * 0.12;
      const availability = weightedPick<OfferAvailability>(["in_stock", "on_order", "none"], special ? [78, 17, 5] : [55, 30, 15]);
      const cost = Math.round((p.price * ratio) / 5) * 5;
      rows.push({
        sku: p.sku,
        productId: p.id,
        cost,
        availability,
        qty: availability === "in_stock" ? randInt(1, 12) : undefined,
        leadDays: s.leadDays,
      });
      const best = costByProduct.get(p.id);
      if (availability !== "none" && (!best || cost < best.cost)) costByProduct.set(p.id, { supplierId: s.id, cost });
    }
    await upsertOffers(db, s.id, rows);
  }

  // Customers (created through orders) — a pool of people who order again
  const people = Array.from({ length: 40 }, () => ({
    firstName: pick(FIRST_NAMES),
    lastName: pick(LAST_NAMES),
    phone: phoneNumber(),
    email: chance(0.55) ? `${["auto", "driver", "mail", "box"][randInt(0, 3)]}${randInt(100, 9999)}@example.com` : undefined,
    city: pick(CITIES),
    car: pick(CARS),
  }));

  // Orders over the last 60 days
  const DELIVERY: DeliveryMethod[] = ["np_branch", "np_locker", "np_courier", "ukrposhta"];
  const PAYMENT: PaymentMethod[] = ["cod", "card_online", "installments", "invoice"];
  const SOURCES: OrderSource[] = ["website", "phone", "manual", "quick_order"];

  const ages: number[] = [];
  for (let i = 0; i < 88; i++) ages.push(Math.floor(Math.pow(rnd(), 1.35) * 60 * 24)); // hours, denser towards today
  ages.sort((a, b) => b - a);

  let seededOrders = 0;
  for (const ageHours of ages) {
    const person = pick(people);
    const createdAt = hoursAgo(ageHours);
    const lineCount = weightedPick([1, 2, 3], [62, 28, 10]);
    const chosen = new Set<Product>();
    while (chosen.size < lineCount) chosen.add(pick(sellable));
    const lines = [...chosen].map((p) => {
      const option = p.option ? p.option.values[randInt(0, p.option.values.length - 1)] : undefined;
      return {
        productId: p.id,
        sku: p.sku,
        name: p.name,
        optionLabel: option && p.option ? `${p.option.name}: ${option.label}` : undefined,
        price: p.price + (option?.priceDelta ?? 0),
        qty: chance(0.2) ? 2 : 1,
      };
    });
    const method = weightedPick(DELIVERY, [58, 17, 15, 10]);
    const payment = weightedPick(PAYMENT, [60, 28, 7, 5]);
    const source = weightedPick(SOURCES, [74, 14, 6, 6]);
    const address =
      method === "np_courier"
        ? `вул. ${pick(["Соборна", "Шевченка", "Лесі Українки", "Франка", "Грушевського"])}, ${randInt(1, 120)}, кв. ${randInt(1, 90)}`
        : method === "ukrposhta"
          ? `${randInt(10000, 79999)}, відділення ${randInt(1, 20)}`
          : method === "np_locker"
            ? `поштомат ${randInt(10000, 39999)}`
            : `відділення ${randInt(1, 180)}`;

    const order = await createOrder(
      db,
      {
        source,
        customer: { firstName: person.firstName, lastName: person.lastName, phone: person.phone, email: person.email },
        delivery: { method, city: person.city, address },
        payment: { method: payment },
        lines,
        comment: chance(0.25) ? pick(["Зателефонуйте після 18:00", "Перевірте, будь ласка, сумісність за VIN", "Потрібно терміново", "Відправте якомога швидше"]) : undefined,
        vehicle: chance(0.6) ? person.car : undefined,
        doNotCall: chance(0.12),
        tags: chance(0.15) ? [pick(["СТО", "оптовик", "постійний"])] : [],
      },
      { id: null, name: "Сайт" },
      { createdAt },
    );
    seededOrders++;

    // Lifecycle by age
    const ageDays = ageHours / 24;
    let target: OrderStatus;
    if (ageDays > 20) target = weightedPick<OrderStatus>(["completed", "cancelled", "returned", "delivered"], [84, 9, 3, 4]);
    else if (ageDays > 8) target = weightedPick<OrderStatus>(["completed", "delivered", "in_transit", "cancelled"], [45, 30, 18, 7]);
    else if (ageDays > 2) target = weightedPick<OrderStatus>(["in_transit", "sourcing", "confirmed", "on_hold", "cancelled"], [40, 32, 14, 8, 6]);
    else target = weightedPick<OrderStatus>(["new", "confirmed", "sourcing", "on_hold"], [55, 25, 12, 8]);

    let t = createdAt;
    const step = (hours: number) => (t = plusHours(t, hours));

    if (target === "new") continue;

    if (target === "cancelled" && chance(0.5)) {
      await changeOrderStatus(db, order.id, "cancelled", actor, { reason: pick(CANCEL_REASONS), now: step(randInt(1, 30)) });
      continue;
    }

    await changeOrderStatus(db, order.id, "confirmed", actor, { now: step(randInt(1, 6)) });
    if (chance(0.5)) {
      await addOrderEvent(db, order.id, "call", actor, "Дзвінок покупцю: підтвердив замовлення, сумісність перевірено", undefined, { at: t });
    }
    if (target === "confirmed") continue;

    if (target === "on_hold") {
      await changeOrderStatus(db, order.id, "on_hold", actor, { now: step(randInt(1, 12)) });
      await addOrderEvent(db, order.id, "note", actor, pick(["Чекаємо на передплату", "Покупець уточнює VIN", "Постачальник підтвердить наявність завтра"]), undefined, { at: t });
      continue;
    }
    if (target === "cancelled") {
      await changeOrderStatus(db, order.id, "cancelled", actor, { reason: pick(CANCEL_REASONS), now: step(randInt(2, 40)) });
      continue;
    }

    // Purchase orders: one per supplier
    const current = (await getOrder(db, order.id))!;
    const bySupplier = new Map<string, typeof current.lines>();
    for (const line of current.lines) {
      const supplierId = line.supplierId ?? costByProduct.get(line.productId ?? "")?.supplierId ?? "sup-elit";
      bySupplier.set(supplierId, [...(bySupplier.get(supplierId) ?? []), line]);
    }
    const poIds: string[] = [];
    for (const [supplierId, poLines] of bySupplier) {
      const po = await createPurchaseOrder(
        db,
        {
          supplierId,
          lines: poLines.map((line) => ({ orderId: order.id, orderLineId: line.id, cost: line.costPrice ?? Math.round(line.price * 0.72) })),
          status: "draft",
        },
        actor,
        { createdAt: step(randInt(1, 5)) },
      );
      poIds.push(po.id);
    }
    const poTarget: PurchaseOrderStatus =
      target === "sourcing" ? weightedPick<PurchaseOrderStatus>(["sent", "confirmed"], [45, 55]) : "received";
    const poSteps: PurchaseOrderStatus[] = ["sent", "confirmed", "shipped", "received"];
    for (const poId of poIds) {
      for (const s of poSteps) {
        await setPurchaseOrderStatus(db, poId, s, actor, s === "shipped" ? { trackingNumber: ttn() } : {});
        if (s === poTarget) break;
      }
    }
    if (target === "sourcing") continue;

    const tracking = ttn();
    await updateOrder(
      db,
      order.id,
      { delivery: { ...current.delivery, trackingNumber: tracking }, updatedAt: step(randInt(6, 30)) },
      actor,
      { type: "delivery_changed", text: `Додано ТТН ${tracking}` },
    );
    await changeOrderStatus(db, order.id, "in_transit", actor, { now: t });
    if (payment === "card_online" || payment === "invoice") {
      await updateOrder(
        db,
        order.id,
        { payment: { ...current.payment, status: "paid", paidAmount: current.total, paidAt: t }, updatedAt: t },
        actor,
        { type: "payment_changed", text: "Оплату отримано" },
      );
    }
    if (target === "in_transit") continue;

    await changeOrderStatus(db, order.id, "delivered", actor, { now: step(randInt(24, 72)) });
    if (target === "delivered") continue;

    if (target === "returned") {
      await changeOrderStatus(db, order.id, "returned", actor, { now: step(randInt(24, 120)) });
      await updateOrder(
        db,
        order.id,
        { payment: { ...current.payment, status: "refunded", paidAmount: 0 }, updatedAt: t },
        actor,
        { type: "payment_changed", text: "Кошти повернено покупцю" },
      );
      continue;
    }

    await changeOrderStatus(db, order.id, "completed", actor, { markPaid: true, now: step(randInt(2, 48)) });
  }

  // Requests
  const KINDS: CallbackKind[] = ["callback", "quick_order", "question", "notify_stock"];
  for (let i = 0; i < 18; i++) {
    const kind = weightedPick(KINDS, [35, 30, 25, 10]);
    const person = pick(people);
    const product = kind === "callback" ? undefined : pick(products);
    const ageHours = Math.floor(Math.pow(rnd(), 1.5) * 10 * 24);
    const status: RequestStatus = ageHours < 24 ? weightedPick<RequestStatus>(["new", "in_progress"], [75, 25]) : weightedPick<RequestStatus>(["done", "spam", "in_progress"], [80, 8, 12]);
    const comments: Record<CallbackKind, string[]> = {
      callback: ["Підкажіть по гальмах на Octavia A7", "Хочу замовити оптом для СТО", "Не можу оформити замовлення на сайті"],
      quick_order: ["Потрібно 2 шт", "Чи є в наявності сьогодні?", "Відправте у Львів"],
      question: ["Чи підійде на 1.6 TDI 2015 року?", "Яка гарантія на цю деталь?", "Є аналоги дешевше?"],
      notify_stock: ["Повідомте, коли з'явиться"],
    };
    await createRequest(
      db,
      {
        kind,
        phone: person.phone,
        name: person.firstName,
        productId: product?.id,
        productName: product?.name,
        productSku: product?.sku,
        comment: pick(comments[kind]),
        status,
      },
      { createdAt: hoursAgo(ageHours) },
    );
  }

  // Reviews awaiting moderation (+ a couple already published)
  const reviewTexts = [
    "Підійшло ідеально, встановили на СТО без проблем. Доставка за два дні.",
    "Якість нормальна за свої гроші, але упаковка була пом'ята.",
    "Менеджер перевірив за VIN, дуже допомогло — у мене рідкісна комплектація.",
    "Замовляв удруге, усе як завжди швидко. Рекомендую.",
    "Деталь оригінальної якості, скрип зник одразу після заміни.",
    "Довго чекав від постачальника, але попередили заздалегідь.",
    "Ціна краща, ніж у місцевих магазинах, доставка НП наступного дня.",
    "Усе добре, тільки хотілося б більше фото в картці товару.",
  ];
  for (let i = 0; i < 8; i++) {
    const product = pick(products);
    await createReview(db, {
      productId: product.id,
      author: pick(FIRST_NAMES),
      rating: weightedPick([5, 4, 3], [60, 30, 10]),
      text: reviewTexts[i],
      car: chance(0.6) ? pick(CARS) : undefined,
      status: i < 6 ? "pending" : "approved",
      source: "site",
      date: daysAgo(randInt(0, 12)).slice(0, 10),
    });
  }

  await saveSettings(db, {});
  await recordAudit(db, {
    actor,
    action: "system.seed",
    entity: "system",
    entityId: "seed",
    summary: `Створено демо-дані: ${SUPPLIERS.length} постачальники, ${seededOrders} замовлень, ${people.length} клієнтів`,
    data: { products: products.length },
  });
}
