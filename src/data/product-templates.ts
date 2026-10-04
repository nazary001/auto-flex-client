/**
 * One template per leaf category (all 58). The deterministic generator in
 * `products.ts` turns each template into 3–6 concrete products: it picks brands
 * from `brandIds`, a price inside `price`, spec values from the `specs`
 * definitions, builds the name and fills the description placeholders.
 *
 * Placeholders understood in `descriptions` and `shortDescription`:
 *   {brand}   brand name (e.g. "Bosch")
 *   {vehicle} "Make Model" for the primary fitment (empty for universal parts)
 *   {noun}    the product noun, lower-cased
 *   {variant} the variant word (e.g. "передні"), empty when none
 *   {sku}     the generated article number
 *   {spec:Назва} the generated value of the spec with that name
 */

/** A spec whose value is either picked from a list or generated in a numeric range. */
export type SpecDef =
  | { name: string; pick: string[] }
  | { name: string; num: [min: number, max: number]; step?: number; unit?: string };

/** A naming variant that yields distinct products (front/rear, outer/inner…). */
export interface VariantDef {
  /** Goes into the product name, agreeing with the noun, e.g. "передні". */
  name: string;
  /** Short latin key used in the slug/sku. */
  key: string;
  /** Spec added to every product of this variant, e.g. { name: "Вісь", value: "передня" }. */
  spec?: { name: string; value: string };
}

export interface OptionValueDef {
  label: string;
  key: string;
  priceDelta: number;
}

export interface OptionDef {
  name: string;
  values: OptionValueDef[];
  /** Index of the value that defines the base price (its delta is normally 0). */
  defaultIndex?: number;
  /** Append the default value label to the product name, e.g. ", 4 л". */
  appendToName?: boolean;
}

export interface CategoryTemplate {
  categoryId: string;
  /** Base noun, e.g. "Гальмівні колодки". Overridden per-product when `subtypes` is set. */
  noun: string;
  brandIds: string[];
  /** Base price range in UAH (price of the default option for optioned products). */
  price: [number, number];
  universal: boolean;
  warrantyMonths: number;
  /** Override the default 3–6 products per category. */
  count?: [number, number];
  variants?: VariantDef[];
  specs: SpecDef[];
  option?: OptionDef;
  /** Brand → product-line names used in the name of universal parts. */
  lines?: Record<string, string[]>;
  /** Alternative nouns picked per product (sensors, car care). */
  subtypes?: string[];
  /** Spec values surfaced in the name of universal parts, in order. */
  nameSpecs?: string[];
  /** Attach an engine note to some fitment rows. */
  engineNote?: boolean;
  descriptions: string[];
}

// ── shared variant / option fragments ───────────────────────

const axlePads: VariantDef[] = [
  { name: "передні", key: "front", spec: { name: "Вісь", value: "передня" } },
  { name: "задні", key: "rear", spec: { name: "Вісь", value: "задня" } },
];
const axleM: VariantDef[] = [
  { name: "передній", key: "front", spec: { name: "Вісь", value: "передня" } },
  { name: "задній", key: "rear", spec: { name: "Вісь", value: "задня" } },
];
const axleF: VariantDef[] = [
  { name: "передня", key: "front", spec: { name: "Вісь", value: "передня" } },
  { name: "задня", key: "rear", spec: { name: "Вісь", value: "задня" } },
];

const sideF: OptionDef = {
  name: "Сторона",
  values: [
    { label: "ліва", key: "left", priceDelta: 0 },
    { label: "права", key: "right", priceDelta: 0 },
  ],
};
const sideM: OptionDef = {
  name: "Сторона",
  values: [
    { label: "лівий", key: "left", priceDelta: 0 },
    { label: "правий", key: "right", priceDelta: 0 },
  ],
};
const sideN: OptionDef = {
  name: "Сторона",
  values: [
    { label: "ліве", key: "left", priceDelta: 0 },
    { label: "праве", key: "right", priceDelta: 0 },
  ],
};

// «Перевірте перед замовленням» paragraph, reused with per-product values.
const checkFit =
  "Перед замовленням звірте артикул {sku}, OE-номери та рік випуску зі своїм авто. Якщо не впевнені у сумісності — надішліть VIN, і ми безкоштовно перевіримо підбір перед відправленням.";
const checkUniversal =
  "Перед замовленням звірте артикул {sku} та характеристики з вимогами виробника вашого авто. Потрібна консультація щодо підбору — напишіть нам, допоможемо.";

export const productTemplates: CategoryTemplate[] = [
  // ── Гальмівна система ───────────────────────────────────
  {
    categoryId: "halmivni-kolodky",
    noun: "Гальмівні колодки",
    brandIds: ["bosch", "brembo", "trw", "ate", "ferodo", "febi-bilstein"],
    price: [650, 3600],
    universal: false,
    warrantyMonths: 12,
    variants: axlePads,
    specs: [
      { name: "Тип гальмівної системи", pick: ["дискові"] },
      { name: "Матеріал накладок", pick: ["низькометалеві", "керамічні", "напівметалеві"] },
      { name: "Висота", num: [48, 74], unit: "мм" },
      { name: "Товщина", num: [16, 20], unit: "мм" },
      { name: "Датчик зносу", pick: ["вбудований", "у комплекті", "без датчика"] },
      { name: "Кількість у комплекті", pick: ["4 шт"] },
    ],
    descriptions: [
      "Комплект гальмівних колодок {brand} ({variant}) для {vehicle}. У наборі чотири колодки — на обидва колеса однієї осі.",
      "Накладки {spec:Матеріал накладок} забезпечують стабільне гальмування та помірний рівень пилу на дисках. Ресурс залежить від стилю їзди й стану гальмівних дисків.",
      checkFit,
    ],
  },
  {
    categoryId: "halmivni-dysky",
    noun: "Гальмівний диск",
    brandIds: ["bosch", "brembo", "ate", "trw", "ferodo"],
    price: [850, 4800],
    universal: false,
    warrantyMonths: 12,
    variants: axleM,
    specs: [
      { name: "Тип диска", pick: ["вентильований", "суцільний", "перфорований"] },
      { name: "Діаметр", num: [256, 345], step: 1, unit: "мм" },
      { name: "Товщина", num: [10, 30], unit: "мм" },
      { name: "Кількість отворів", pick: ["4", "5"] },
      { name: "Покриття", pick: ["антикорозійне", "без покриття"] },
    ],
    descriptions: [
      "Гальмівний диск {brand} ({variant}) для {vehicle}. Ціну вказано за один диск — для осі потрібні два.",
      "Диск типу «{spec:Тип диска}» діаметром {spec:Діаметр}. Диски рекомендовано міняти парою на одній осі та разом із колодками.",
      checkFit,
    ],
  },
  {
    categoryId: "halmivni-suporty",
    noun: "Гальмівний супорт",
    brandIds: ["trw", "ate", "brembo", "febi-bilstein"],
    price: [2400, 9500],
    universal: false,
    warrantyMonths: 24,
    variants: axleM,
    specs: [
      { name: "Діаметр поршня", num: [38, 60], unit: "мм" },
      { name: "Кількість поршнів", pick: ["1", "2"] },
      { name: "Матеріал корпусу", pick: ["чавун", "алюміній"] },
      { name: "Стан", pick: ["новий", "відновлений"] },
      { name: "Кронштейн", pick: ["у комплекті", "без кронштейна"] },
    ],
    descriptions: [
      "Гальмівний супорт {brand} ({variant}) для {vehicle}. Ціна за одну сторону.",
      "Поршень діаметром {spec:Діаметр поршня}, корпус — {spec:Матеріал корпусу}. Перед установкою рекомендовано замінити гальмівну рідину та прокачати систему.",
      checkFit,
    ],
  },
  {
    categoryId: "halmivni-shlanhy",
    noun: "Гальмівний шланг",
    brandIds: ["ate", "trw", "febi-bilstein"],
    price: [160, 800],
    universal: false,
    warrantyMonths: 12,
    variants: axleM,
    specs: [
      { name: "Довжина", num: [250, 560], step: 5, unit: "мм" },
      { name: "Тип різьби", pick: ["M10x1", "банджо"] },
      { name: "Матеріал", pick: ["гума з текстильним кордом"] },
      { name: "Робочий тиск", num: [90, 120], unit: "бар" },
    ],
    descriptions: [
      "Гальмівний шланг {brand} ({variant}) для {vehicle}. З'єднує магістраль із супортом і витримує тиск гальмівної системи.",
      "Довжина {spec:Довжина}, приєднання «{spec:Тип різьби}». Після заміни обов'язково прокачайте гальма.",
      checkFit,
    ],
  },
  {
    categoryId: "datchyky-abs",
    noun: "Датчик ABS",
    brandIds: ["bosch", "ate", "hella", "febi-bilstein"],
    price: [420, 2400],
    universal: false,
    warrantyMonths: 12,
    variants: axleM,
    specs: [
      { name: "Тип датчика", pick: ["активний", "пасивний"] },
      { name: "Довжина кабелю", num: [420, 980], step: 10, unit: "мм" },
      { name: "Кількість контактів", pick: ["2"] },
      { name: "Розташування", pick: ["передній лівий", "передній правий", "задній лівий", "задній правий"] },
    ],
    descriptions: [
      "Датчик швидкості обертання колеса (ABS) {brand} для {vehicle}, {variant}. Передає сигнал до блоку ABS/ESP.",
      "{spec:Тип датчика} датчик із кабелем {spec:Довжина кабелю}. Несправність зазвичай супроводжується помилкою ABS на панелі приладів.",
      checkFit,
    ],
  },

  // ── Двигун ──────────────────────────────────────────────
  {
    categoryId: "komplekty-hrm",
    noun: "Комплект ГРМ",
    brandIds: ["gates", "contitech", "ina", "skf", "febi-bilstein"],
    price: [1400, 7200],
    universal: false,
    warrantyMonths: 24,
    engineNote: true,
    specs: [
      { name: "Кількість зубів ременя", num: [120, 160], unit: "зуб." },
      { name: "Ширина ременя", num: [22, 30], unit: "мм" },
      { name: "Помпа в комплекті", pick: ["так", "ні"] },
      { name: "Склад комплекту", pick: ["ремінь + ролики", "ремінь + ролики + помпа"] },
      { name: "Ресурс", pick: ["60 000 км", "90 000 км", "120 000 км"] },
    ],
    descriptions: [
      "Комплект газорозподільного механізму {brand} для {vehicle}: ремінь та натяжні/обвідні ролики.",
      "Варіант комплектації — «{spec:Склад комплекту}». ГРМ міняють повним комплектом за регламентом, щоб уникнути обриву ременя й пошкодження клапанів.",
      checkFit,
    ],
  },
  {
    categoryId: "svichky-zapaliuvannia",
    noun: "Свічка запалювання",
    brandIds: ["ngk", "bosch", "denso"],
    price: [140, 700],
    universal: false,
    warrantyMonths: 12,
    engineNote: true,
    specs: [
      { name: "Тип електрода", pick: ["нікелевий", "іридієвий", "платиновий"] },
      { name: "Кількість електродів", pick: ["1", "2", "3", "4"] },
      { name: "Зазор", pick: ["0.8 мм", "0.9 мм", "1.0 мм", "1.1 мм"] },
      { name: "Різьба", pick: ["M12x1.25", "M14x1.25"] },
      { name: "Ключ", pick: ["16 мм", "18 мм"] },
    ],
    descriptions: [
      "Свічка запалювання {brand} для {vehicle}. Ціну вказано за одну свічку — замовляйте за кількістю циліндрів.",
      "{spec:Тип електрода} електрод, зазор {spec:Зазор}. Свічки міняють повним комплектом за регламентом ТО.",
      checkFit,
    ],
  },
  {
    categoryId: "kotushky-zapaliuvannia",
    noun: "Котушка запалювання",
    brandIds: ["bosch", "ngk", "hella", "valeo"],
    price: [600, 3200],
    universal: false,
    warrantyMonths: 24,
    engineNote: true,
    specs: [
      { name: "Тип", pick: ["індивідуальна", "блок котушок"] },
      { name: "Кількість контактів", pick: ["2", "3", "4"] },
      { name: "Первинний опір", pick: ["0.5 Ом", "0.7 Ом", "1.0 Ом"] },
      { name: "Кількість виводів", pick: ["1", "4"] },
    ],
    descriptions: [
      "Котушка запалювання {brand} для {vehicle}. Формує високу напругу для іскроутворення на свічці.",
      "Виконання — «{spec:Тип}». Ознаки несправності: пропуски запалювання, нестабільний холостий хід, помилка по циліндру.",
      checkFit,
    ],
  },
  {
    categoryId: "prokladky-dvyhuna",
    noun: "Комплект прокладок двигуна",
    subtypes: ["Прокладка ГБЦ", "Комплект прокладок двигуна", "Прокладка клапанної кришки"],
    brandIds: ["mahle", "corteco", "febi-bilstein", "valeo"],
    price: [320, 4500],
    universal: false,
    warrantyMonths: 12,
    engineNote: true,
    specs: [
      { name: "Матеріал", pick: ["багатошаровий метал", "еластомер", "безазбестовий"] },
      { name: "Кількість отворів (ГБЦ)", pick: ["4", "5", "н/д"] },
      { name: "Товщина", pick: ["0.8 мм", "1.2 мм", "1.4 мм", "н/д"] },
      { name: "Герметик у комплекті", pick: ["так", "ні"] },
    ],
    descriptions: [
      "{noun} {brand} для {vehicle}. Відновлює герметичність з'єднань двигуна.",
      "Матеріал — {spec:Матеріал}. Болти головки блока зазвичай одноразові й потребують заміни разом із прокладкою.",
      checkFit,
    ],
  },
  {
    categoryId: "vodiani-pompy",
    noun: "Водяна помпа",
    brandIds: ["gates", "skf", "ina", "mahle", "febi-bilstein"],
    price: [700, 3800],
    universal: false,
    warrantyMonths: 24,
    engineNote: true,
    specs: [
      { name: "Привід", pick: ["ремінь ГРМ", "поліклиновий ремінь"] },
      { name: "Матеріал крильчатки", pick: ["метал", "пластик композит"] },
      { name: "Кількість лопатей", num: [6, 9], unit: "шт" },
      { name: "Прокладка в комплекті", pick: ["так", "ні"] },
    ],
    descriptions: [
      "Водяна помпа (насос охолоджувальної рідини) {brand} для {vehicle}.",
      "Привід від {spec:Привід}. Помпу доцільно міняти разом із комплектом ГРМ та охолоджувальною рідиною.",
      checkFit,
    ],
  },
  {
    categoryId: "opory-dvyhuna",
    noun: "Опора двигуна",
    brandIds: ["febi-bilstein", "lemforder", "corteco"],
    price: [500, 3200],
    universal: false,
    warrantyMonths: 12,
    engineNote: true,
    specs: [
      { name: "Розташування", pick: ["права", "ліва", "задня", "передня"] },
      { name: "Тип", pick: ["гідравлічна", "гумометалева"] },
      { name: "Матеріал", pick: ["гума + метал"] },
      { name: "Кронштейн", pick: ["у комплекті", "без кронштейна"] },
    ],
    descriptions: [
      "Опора (подушка) двигуна {brand} для {vehicle}, розташування — {spec:Розташування}.",
      "{spec:Тип} опора гасить вібрації силового агрегату. Знос супроводжується поштовхами та стуками під час рушання.",
      checkFit,
    ],
  },

  // ── Фільтри ─────────────────────────────────────────────
  {
    categoryId: "masliani-filtry",
    noun: "Масляний фільтр",
    brandIds: ["mann-filter", "mahle", "knecht", "bosch"],
    price: [120, 650],
    universal: false,
    warrantyMonths: 12,
    engineNote: true,
    specs: [
      { name: "Тип", pick: ["накручуваний", "фільтр-вставка"] },
      { name: "Висота", num: [65, 150], step: 1, unit: "мм" },
      { name: "Зовнішня різьба", pick: ["M20x1.5", "3/4-16 UNF", "н/д"] },
      { name: "Зворотний клапан", pick: ["так", "ні"] },
    ],
    descriptions: [
      "Масляний фільтр {brand} для {vehicle}. Затримує продукти зносу й забруднення в системі змащення.",
      "Виконання — «{spec:Тип}». Міняється разом із моторною оливою на кожному ТО.",
      checkFit,
    ],
  },
  {
    categoryId: "povitriani-filtry",
    noun: "Повітряний фільтр",
    brandIds: ["mann-filter", "mahle", "knecht", "bosch"],
    price: [180, 1100],
    universal: false,
    warrantyMonths: 12,
    engineNote: true,
    specs: [
      { name: "Форма", pick: ["панельний", "циліндричний"] },
      { name: "Довжина", num: [180, 340], step: 1, unit: "мм" },
      { name: "Ширина", num: [130, 240], step: 1, unit: "мм" },
      { name: "Висота", num: [30, 70], step: 1, unit: "мм" },
    ],
    descriptions: [
      "Повітряний фільтр двигуна {brand} для {vehicle}. Очищає повітря, що надходить у впускний тракт.",
      "{spec:Форма} елемент розміром {spec:Довжина} × {spec:Ширина}. Забруднений фільтр збільшує витрату пального та знижує тягу.",
      checkFit,
    ],
  },
  {
    categoryId: "palyvni-filtry",
    noun: "Паливний фільтр",
    brandIds: ["mann-filter", "mahle", "bosch", "knecht"],
    price: [200, 1600],
    universal: false,
    warrantyMonths: 12,
    engineNote: true,
    specs: [
      { name: "Тип палива", pick: ["бензин", "дизель"] },
      { name: "Виконання", pick: ["магістральний", "фільтр-вставка", "у зборі з корпусом"] },
      { name: "Діаметр патрубка", pick: ["8 мм", "10 мм"] },
      { name: "Сепаратор води", pick: ["так", "ні"] },
    ],
    descriptions: [
      "Паливний фільтр {brand} для {vehicle} ({spec:Тип палива}).",
      "Виконання — «{spec:Виконання}». На дизелях своєчасна заміна захищає паливну апаратуру високого тиску.",
      checkFit,
    ],
  },
  {
    categoryId: "filtry-salonu",
    noun: "Фільтр салону",
    brandIds: ["mann-filter", "mahle", "knecht", "bosch"],
    price: [150, 1200],
    universal: false,
    warrantyMonths: 12,
    specs: [
      { name: "Тип", pick: ["протипиловий", "вугільний", "антиалергенний"] },
      { name: "Довжина", num: [180, 300], step: 1, unit: "мм" },
      { name: "Ширина", num: [160, 250], step: 1, unit: "мм" },
      { name: "Висота", num: [20, 40], step: 1, unit: "мм" },
    ],
    descriptions: [
      "Салонний фільтр {brand} для {vehicle}. Очищає повітря, що надходить у систему вентиляції й клімату.",
      "{spec:Тип} фільтр. Вугільний варіант додатково затримує запахи та вихлопні гази.",
      checkFit,
    ],
  },

  // ── Підвіска та рульове ─────────────────────────────────
  {
    categoryId: "amortyzatory",
    noun: "Амортизатор",
    brandIds: ["kyb", "sachs", "monroe", "bilstein", "febi-bilstein"],
    price: [900, 5500],
    universal: false,
    warrantyMonths: 24,
    variants: axleM,
    specs: [
      { name: "Тип", pick: ["газомасляний", "газовий", "масляний"] },
      { name: "Виконання", pick: ["стійка", "патрон", "амортизатор"] },
      { name: "Спосіб кріплення (верх)", pick: ["проушина", "штир"] },
      { name: "Спосіб кріплення (низ)", pick: ["проушина", "вилка"] },
    ],
    descriptions: [
      "Амортизатор {brand} ({variant}) для {vehicle}. Ціна за одну штуку.",
      "{spec:Тип} амортизатор, виконання «{spec:Виконання}». Елементи підвіски міняють парою на осі для рівномірної роботи.",
      checkFit,
    ],
  },
  {
    categoryId: "pruzhyny-pidvisky",
    noun: "Пружина підвіски",
    brandIds: ["kyb", "monroe", "febi-bilstein"],
    price: [500, 3200],
    universal: false,
    warrantyMonths: 24,
    variants: axleF,
    specs: [
      { name: "Кількість витків", num: [6, 9], unit: "шт" },
      { name: "Діаметр прутка", pick: ["12 мм", "13 мм", "13.5 мм", "14 мм"] },
      { name: "Покриття", pick: ["епоксидне антикорозійне"] },
      { name: "Навантаження", pick: ["стандартне", "посилене"] },
    ],
    descriptions: [
      "Пружина підвіски {brand} ({variant}) для {vehicle}. Ціна за одну пружину.",
      "Пруток {spec:Діаметр прутка}, {spec:Навантаження} навантаження. Пружини рекомендовано міняти парою на одній осі.",
      checkFit,
    ],
  },
  {
    categoryId: "vazheli-pidvisky",
    noun: "Важіль підвіски",
    brandIds: ["lemforder", "trw", "febi-bilstein"],
    price: [600, 4500],
    universal: false,
    warrantyMonths: 24,
    option: sideM,
    specs: [
      { name: "Розташування", pick: ["передній нижній", "передній верхній", "задній"] },
      { name: "Матеріал", pick: ["сталь", "алюміній"] },
      { name: "Сайлентблоки", pick: ["у зборі", "без сайлентблоків"] },
      { name: "Кульова опора", pick: ["вбудована", "окремо"] },
    ],
    descriptions: [
      "Важіль підвіски {brand} для {vehicle}, розташування — {spec:Розташування}. Оберіть сторону встановлення у картці товару.",
      "Корпус із {spec:Матеріал}, сайлентблоки — {spec:Сайлентблоки}. Після заміни потрібне розвал-сходження.",
      checkFit,
    ],
  },
  {
    categoryId: "kulovi-opory",
    noun: "Кульова опора",
    brandIds: ["lemforder", "trw", "febi-bilstein"],
    price: [250, 1800],
    universal: false,
    warrantyMonths: 12,
    option: sideF,
    specs: [
      { name: "Діаметр конуса", pick: ["16 мм", "17 мм", "18 мм"] },
      { name: "Різьба пальця", pick: ["M12", "M14", "M16"] },
      { name: "Кріплення", pick: ["під запресовку", "болтове"] },
      { name: "Пильник", pick: ["у комплекті"] },
    ],
    descriptions: [
      "Кульова опора {brand} для {vehicle}. Оберіть сторону у картці товару.",
      "Конус {spec:Діаметр конуса}, кріплення — {spec:Кріплення}. Люфт в опорі спричиняє стуки й нерівномірний знос шин.",
      checkFit,
    ],
  },
  {
    categoryId: "stiiky-stabilizatora",
    noun: "Стійка стабілізатора",
    brandIds: ["lemforder", "trw", "febi-bilstein", "skf"],
    price: [150, 1200],
    universal: false,
    warrantyMonths: 12,
    option: sideF,
    specs: [
      { name: "Вісь", pick: ["передня", "задня"] },
      { name: "Довжина", num: [70, 320], step: 5, unit: "мм" },
      { name: "Різьба", pick: ["M10", "M12"] },
      { name: "Матеріал корпусу", pick: ["сталь", "пластик + сталь"] },
    ],
    descriptions: [
      "Стійка (лінк) стабілізатора {brand} для {vehicle}, {spec:Вісь} вісь. Оберіть сторону у картці товару.",
      "Довжина {spec:Довжина}. Зношені стійки видають характерний стукіт на нерівностях.",
      checkFit,
    ],
  },
  {
    categoryId: "rulovi-nakonechnyky",
    noun: "Рульовий наконечник",
    brandIds: ["lemforder", "trw", "febi-bilstein"],
    price: [250, 1600],
    universal: false,
    warrantyMonths: 12,
    option: sideM,
    specs: [
      { name: "Різьба пальця", pick: ["M12x1.5", "M14x1.5"] },
      { name: "Різьба корпусу", pick: ["M14x1.5", "M16x1.5"] },
      { name: "Конус", pick: ["12 мм", "13 мм", "14 мм"] },
      { name: "Пильник", pick: ["у комплекті"] },
    ],
    descriptions: [
      "Рульовий наконечник {brand} для {vehicle}. Оберіть сторону у картці товару.",
      "Палець {spec:Різьба пальця}, конус {spec:Конус}. Після заміни обов'язкове сходження коліс.",
      checkFit,
    ],
  },
  {
    categoryId: "pidshypnyky-matochyny",
    noun: "Підшипник маточини",
    brandIds: ["skf", "fag", "febi-bilstein"],
    price: [450, 3500],
    universal: false,
    warrantyMonths: 24,
    variants: axleM,
    specs: [
      { name: "Виконання", pick: ["підшипник", "маточина в зборі", "ремкомплект"] },
      { name: "Внутрішній діаметр", num: [30, 45], unit: "мм" },
      { name: "Зовнішній діаметр", num: [68, 86], unit: "мм" },
      { name: "Датчик ABS", pick: ["вбудоване кільце", "без датчика"] },
    ],
    descriptions: [
      "Підшипник маточини {brand} ({variant}) для {vehicle}.",
      "Виконання — «{spec:Виконання}». Гул, що зростає зі швидкістю, — типова ознака зносу маточинного підшипника.",
      checkFit,
    ],
  },

  // ── Трансмісія ──────────────────────────────────────────
  {
    categoryId: "komplekty-zcheplennia",
    noun: "Комплект зчеплення",
    brandIds: ["luk", "sachs", "valeo"],
    price: [2500, 14000],
    universal: false,
    warrantyMonths: 24,
    engineNote: true,
    specs: [
      { name: "Діаметр диска", num: [190, 240], step: 1, unit: "мм" },
      { name: "Кількість шліців", num: [18, 26], unit: "шт" },
      { name: "Склад комплекту", pick: ["диск + кошик + вижимний", "диск + кошик"] },
      { name: "Вижимний підшипник", pick: ["механічний", "гідравлічний"] },
    ],
    descriptions: [
      "Комплект зчеплення {brand} для {vehicle}: ведений диск, кошик та вижимний підшипник (залежно від комплектації).",
      "Діаметр диска {spec:Діаметр диска}, {spec:Кількість шліців} шліців. Зчеплення змінюють комплектом; за потреби перевіряють стан маховика.",
      checkFit,
    ],
  },
  {
    categoryId: "shrusy",
    noun: "ШРУС",
    brandIds: ["skf", "febi-bilstein", "lemforder"],
    price: [600, 3500],
    universal: false,
    warrantyMonths: 12,
    engineNote: true,
    variants: [
      { name: "зовнішній", key: "outer", spec: { name: "Розташування", value: "зовнішній" } },
      { name: "внутрішній", key: "inner", spec: { name: "Розташування", value: "внутрішній" } },
    ],
    specs: [
      { name: "Кількість шліців (внутр.)", num: [22, 30], unit: "шт" },
      { name: "Кількість шліців (зовн.)", num: [22, 36], unit: "шт" },
      { name: "Пильник і змазка", pick: ["у комплекті"] },
      { name: "Тип", pick: ["кульковий", "триподний"] },
    ],
    descriptions: [
      "ШРУС {variant} {brand} для {vehicle}. Комплект із пильником і змазкою.",
      "З'єднання «{spec:Тип}». Хрускіт у поворотах — типова ознака зносу зовнішнього ШРУСа.",
      checkFit,
    ],
  },
  {
    categoryId: "pivosi",
    noun: "Піввісь",
    brandIds: ["skf", "febi-bilstein", "lemforder"],
    price: [1800, 9000],
    universal: false,
    warrantyMonths: 12,
    option: sideF,
    specs: [
      { name: "Довжина", num: [550, 900], step: 5, unit: "мм" },
      { name: "Шліци (з боку КПП)", num: [22, 30], unit: "шт" },
      { name: "Шліци (з боку маточини)", num: [24, 36], unit: "шт" },
      { name: "ABS-кільце", pick: ["так", "ні"] },
    ],
    descriptions: [
      "Піввісь (привідний вал) {brand} у зборі для {vehicle}. Оберіть сторону у картці товару.",
      "Довжина {spec:Довжина}. Вал постачається з обома ШРУСами, пильниками й змазкою.",
      checkFit,
    ],
  },
  {
    categoryId: "makhovyky",
    noun: "Маховик",
    brandIds: ["luk", "sachs", "valeo"],
    price: [4000, 22000],
    universal: false,
    warrantyMonths: 24,
    engineNote: true,
    specs: [
      { name: "Тип", pick: ["двомасовий", "одномасовий"] },
      { name: "Кількість зубів вінця", num: [120, 150], unit: "шт" },
      { name: "Кількість отворів кріплення", pick: ["6", "8"] },
      { name: "Діаметр", num: [220, 260], unit: "мм" },
    ],
    descriptions: [
      "Маховик {brand} для {vehicle}. Виконання — «{spec:Тип}».",
      "Двомасовий маховик гасить крутильні коливання; його стан перевіряють під час заміни зчеплення.",
      checkFit,
    ],
  },

  // ── Електрика ───────────────────────────────────────────
  {
    categoryId: "akumuliatory",
    noun: "Акумулятор",
    brandIds: ["varta", "bosch", "westa"],
    price: [1800, 7500],
    universal: true,
    warrantyMonths: 24,
    lines: {
      varta: ["Blue Dynamic", "Silver Dynamic", "Black Dynamic"],
      bosch: ["S4", "S5", "S3"],
      westa: ["Standard", "6CT Premium"],
    },
    nameSpecs: ["Ємність"],
    specs: [
      { name: "Ємність", pick: ["55 Ah", "60 Ah", "62 Ah", "74 Ah", "77 Ah", "95 Ah"] },
      { name: "Пусковий струм", pick: ["480 A", "540 A", "600 A", "680 A", "760 A", "830 A"] },
      { name: "Полярність", pick: ["зворотна (R+)", "пряма (L+)"] },
      { name: "Технологія", pick: ["Ca/Ca", "EFB", "AGM"] },
      { name: "Напруга", pick: ["12 В"] },
    ],
    descriptions: [
      "Стартерний акумулятор {brand} ємністю {spec:Ємність}, пусковий струм {spec:Пусковий струм}.",
      "Технологія {spec:Технологія}, полярність {spec:Полярність}. Перед купівлею звірте габарити, розташування клем і тип кріплення з наявним АКБ.",
      checkUniversal,
    ],
  },
  {
    categoryId: "heneratory",
    noun: "Генератор",
    brandIds: ["bosch", "valeo", "denso", "hella"],
    price: [3000, 14000],
    universal: false,
    warrantyMonths: 12,
    specs: [
      { name: "Напруга", pick: ["12 В"] },
      { name: "Струм віддачі", pick: ["90 A", "110 A", "120 A", "140 A", "150 A"] },
      { name: "Кількість струмків шківа", pick: ["5", "6"] },
      { name: "Стан", pick: ["новий", "відновлений"] },
    ],
    descriptions: [
      "Генератор {brand} для {vehicle}, струм віддачі {spec:Струм віддачі}.",
      "Шків на {spec:Кількість струмків шківа} струмків. Ознаки несправності: горить лампа АКБ, недозаряд або шум підшипника.",
      checkFit,
    ],
  },
  {
    categoryId: "startery",
    noun: "Стартер",
    brandIds: ["bosch", "valeo", "denso", "hella"],
    price: [2500, 11000],
    universal: false,
    warrantyMonths: 12,
    specs: [
      { name: "Напруга", pick: ["12 В"] },
      { name: "Потужність", pick: ["1.1 кВт", "1.4 кВт", "1.7 кВт", "2.0 кВт"] },
      { name: "Кількість зубів", pick: ["9", "10", "11", "13"] },
      { name: "Стан", pick: ["новий", "відновлений"] },
    ],
    descriptions: [
      "Стартер {brand} для {vehicle}, потужність {spec:Потужність}.",
      "Шестерня на {spec:Кількість зубів} зубів. Перед замовленням звірте бік установки та кількість кріпильних вух.",
      checkFit,
    ],
  },
  {
    categoryId: "datchyky-dvyhuna",
    noun: "Датчик двигуна",
    brandIds: ["bosch", "hella", "denso", "febi-bilstein"],
    price: [350, 2800],
    universal: false,
    warrantyMonths: 12,
    engineNote: true,
    subtypes: [
      "Датчик коленвала",
      "Датчик розподільчого валу",
      "Витратомір повітря",
      "Датчик тиску (MAP)",
      "Датчик детонації",
      "Датчик температури ОЖ",
    ],
    specs: [
      { name: "Тип виходу", pick: ["аналоговий", "цифровий"] },
      { name: "Кількість контактів", pick: ["2", "3", "4", "5"] },
      { name: "Довжина кабелю", num: [250, 900], step: 10, unit: "мм" },
      { name: "Робоча напруга", pick: ["5 В", "12 В"] },
    ],
    descriptions: [
      "{noun} {brand} для {vehicle}.",
      "{spec:Тип виходу} сигнал, {spec:Кількість контактів} контакти. Несправність датчика зазвичай викликає помилку Check Engine та нестабільну роботу двигуна.",
      checkFit,
    ],
  },
  {
    categoryId: "svichky-rozzharennia",
    noun: "Свічка розжарювання",
    brandIds: ["ngk", "bosch", "denso"],
    price: [250, 1200],
    universal: false,
    warrantyMonths: 12,
    engineNote: true,
    specs: [
      { name: "Напруга", pick: ["4.4 В", "5 В", "7 В", "11 В"] },
      { name: "Час розжарювання", pick: ["3 с", "5 с", "7 с"] },
      { name: "Різьба", pick: ["M8x1", "M10x1.25"] },
      { name: "Матеріал стрижня", pick: ["металевий", "керамічний"] },
    ],
    descriptions: [
      "Свічка розжарювання {brand} для дизельного {vehicle}. Ціна за одну свічку.",
      "Напруга {spec:Напруга}, {spec:Матеріал стрижня} стрижень. Свічки міняють повним комплектом за кількістю циліндрів.",
      checkFit,
    ],
  },

  // ── Освітлення ──────────────────────────────────────────
  {
    categoryId: "fary",
    noun: "Фара",
    brandIds: ["hella", "valeo", "depo"],
    price: [1800, 16000],
    universal: false,
    warrantyMonths: 12,
    option: sideF,
    specs: [
      { name: "Тип оптики", pick: ["галоген", "лінза", "ксенон", "LED"] },
      { name: "Регулювання", pick: ["ручне", "електрокоректор"] },
      { name: "Тип цоколя", pick: ["H4", "H7", "H7/H15", "D3S"] },
      { name: "Колір розсіювача", pick: ["прозорий"] },
    ],
    descriptions: [
      "Фара {brand} для {vehicle}. Оберіть сторону у картці товару. Лампи й блок розжарювання до комплекту зазвичай не входять.",
      "Оптика типу «{spec:Тип оптики}», {spec:Регулювання} коректор. Звірте тип фари й роз'єми з вашою комплектацією.",
      checkFit,
    ],
  },
  {
    categoryId: "zadni-likhtari",
    noun: "Ліхтар задній",
    brandIds: ["hella", "depo", "valeo"],
    price: [900, 7000],
    universal: false,
    warrantyMonths: 12,
    option: sideM,
    specs: [
      { name: "Розташування", pick: ["зовнішній (на крилі)", "внутрішній (на кришці)"] },
      { name: "Тип ламп", pick: ["лампи розжарювання", "LED"] },
      { name: "Колір", pick: ["червоно-димчастий", "червоно-білий"] },
      { name: "Роз'єм", pick: ["штатний"] },
    ],
    descriptions: [
      "Задній ліхтар {brand} для {vehicle}. Оберіть сторону у картці товару.",
      "Розташування — «{spec:Розташування}». Перед замовленням звірте тип (кузов/кришка багажника) та к-сть контактів роз'єму.",
      checkFit,
    ],
  },
  {
    categoryId: "avtolampy",
    noun: "Автолампа",
    brandIds: ["osram", "philips", "bosch", "hella"],
    price: [60, 900],
    universal: true,
    warrantyMonths: 6,
    lines: {
      osram: ["Original", "Night Breaker", "Cool Blue"],
      philips: ["Vision", "X-tremeVision", "WhiteVision"],
      bosch: ["Pure Light", "Plus"],
      hella: ["Standard"],
    },
    nameSpecs: ["Цоколь", "Параметри"],
    specs: [
      { name: "Цоколь", pick: ["H1", "H4", "H7", "H11", "HB3", "HB4"] },
      { name: "Параметри", pick: ["12V 55W", "12V 60/55W", "12V 65W"] },
      { name: "Тип", pick: ["галогенна", "світлодіодна"] },
      { name: "Кількість у блістері", pick: ["1 шт", "2 шт"] },
    ],
    descriptions: [
      "Автомобільна лампа {brand} з цоколем {spec:Цоколь} ({spec:Параметри}).",
      "Лампи головного світла рекомендовано міняти парами для рівномірного світлового потоку.",
      checkUniversal,
    ],
  },
  {
    categoryId: "protytumanni-fary",
    noun: "Протитуманна фара",
    brandIds: ["hella", "valeo", "depo"],
    price: [700, 4500],
    universal: false,
    warrantyMonths: 12,
    option: sideF,
    specs: [
      { name: "Тип оптики", pick: ["галоген", "LED"] },
      { name: "Тип цоколя", pick: ["H8", "H11", "HB4"] },
      { name: "Матеріал скла", pick: ["скло", "полікарбонат"] },
      { name: "Кріплення", pick: ["у бампер", "із рамкою"] },
    ],
    descriptions: [
      "Протитуманна фара {brand} для {vehicle}. Оберіть сторону у картці товару.",
      "Оптика «{spec:Тип оптики}», цоколь {spec:Тип цоколя}. Звірте форму й посадкове місце з бампером вашої комплектації.",
      checkFit,
    ],
  },

  // ── Охолодження та клімат ───────────────────────────────
  {
    categoryId: "radiatory-okholodzhennia",
    noun: "Радіатор охолодження",
    brandIds: ["nissens", "mahle", "valeo", "denso"],
    price: [1500, 8500],
    universal: false,
    warrantyMonths: 24,
    engineNote: true,
    specs: [
      { name: "Матеріал", pick: ["алюміній + пластик"] },
      { name: "Тип збірки", pick: ["паяний", "збірний"] },
      { name: "Розміри серцевини", pick: ["620×410 мм", "650×415 мм", "480×390 мм", "720×470 мм"] },
      { name: "Тип КПП", pick: ["МКПП", "АКПП", "універсальний"] },
    ],
    descriptions: [
      "Радіатор системи охолодження {brand} для {vehicle}.",
      "{spec:Тип збірки} радіатор, серцевина {spec:Розміри серцевини}. Під час заміни оновіть охолоджувальну рідину.",
      checkFit,
    ],
  },
  {
    categoryId: "termostaty",
    noun: "Термостат",
    brandIds: ["mahle", "gates", "febi-bilstein", "valeo"],
    price: [300, 1800],
    universal: false,
    warrantyMonths: 12,
    engineNote: true,
    specs: [
      { name: "Температура відкриття", pick: ["83 °C", "87 °C", "88 °C", "90 °C", "92 °C"] },
      { name: "Виконання", pick: ["термоелемент", "у зборі з корпусом"] },
      { name: "Прокладка в комплекті", pick: ["так", "ні"] },
      { name: "Діаметр", num: [48, 68], unit: "мм" },
    ],
    descriptions: [
      "Термостат {brand} для {vehicle}, температура відкриття {spec:Температура відкриття}.",
      "Виконання — «{spec:Виконання}». Несправний термостат спричиняє перегрів або тривалий прогрів двигуна.",
      checkFit,
    ],
  },
  {
    categoryId: "ventyliatory-radiatora",
    noun: "Вентилятор радіатора",
    brandIds: ["nissens", "valeo", "hella", "denso"],
    price: [1500, 7500],
    universal: false,
    warrantyMonths: 12,
    specs: [
      { name: "Діаметр крильчатки", num: [280, 420], step: 5, unit: "мм" },
      { name: "Кількість лопатей", num: [5, 11], unit: "шт" },
      { name: "Потужність", pick: ["200 Вт", "300 Вт", "400 Вт"] },
      { name: "Виконання", pick: ["вентилятор", "у зборі з дифузором"] },
    ],
    descriptions: [
      "Вентилятор радіатора {brand} для {vehicle}.",
      "Крильчатка {spec:Діаметр крильчатки} на {spec:Кількість лопатей} лопатей, виконання «{spec:Виконання}».",
      checkFit,
    ],
  },
  {
    categoryId: "kompresory-kondytsionera",
    noun: "Компресор кондиціонера",
    brandIds: ["nissens", "valeo", "denso", "mahle"],
    price: [5000, 22000],
    universal: false,
    warrantyMonths: 12,
    engineNote: true,
    specs: [
      { name: "Тип", pick: ["з муфтою", "з керованою продуктивністю"] },
      { name: "Кількість струмків шківа", pick: ["5", "6", "7"] },
      { name: "Діаметр шківа", num: [100, 130], unit: "мм" },
      { name: "Хладагент", pick: ["R134a", "R1234yf"] },
    ],
    descriptions: [
      "Компресор кондиціонера {brand} для {vehicle}.",
      "Виконання «{spec:Тип}», хладагент {spec:Хладагент}. Після заміни потрібні вакуумування та заправлення системи у сервісі.",
      checkFit,
    ],
  },

  // ── Кузовні деталі ──────────────────────────────────────
  {
    categoryId: "bampery",
    noun: "Бампер",
    brandIds: ["signeda", "klokkerholm", "depo"],
    price: [2500, 16000],
    universal: false,
    warrantyMonths: 6,
    variants: [
      { name: "передній", key: "front", spec: { name: "Розташування", value: "передній" } },
      { name: "задній", key: "rear", spec: { name: "Розташування", value: "задній" } },
    ],
    specs: [
      { name: "Матеріал", pick: ["ABS-пластик"] },
      { name: "Під фарбування", pick: ["так"] },
      { name: "Отвори під ПТФ", pick: ["так", "ні"] },
      { name: "Отвори під парктронік", pick: ["так", "ні"] },
    ],
    descriptions: [
      "Бампер {variant} {brand} для {vehicle}. Постачається незабарвленим, під фарбування у колір кузова.",
      "Матеріал — {spec:Матеріал}. Решітки, молдинги та датчики встановлюються зі штатного бампера або замовляються окремо.",
      checkFit,
    ],
  },
  {
    categoryId: "kryla",
    noun: "Крило",
    brandIds: ["signeda", "klokkerholm", "depo"],
    price: [1200, 7000],
    universal: false,
    warrantyMonths: 6,
    option: sideN,
    specs: [
      { name: "Розташування", pick: ["переднє"] },
      { name: "Матеріал", pick: ["сталь", "оцинкована сталь"] },
      { name: "Під фарбування", pick: ["так"] },
      { name: "Отвір під повторювач", pick: ["так", "ні"] },
    ],
    descriptions: [
      "Переднє крило {brand} для {vehicle}. Оберіть сторону у картці товару. Постачається під фарбування.",
      "Матеріал — {spec:Матеріал}. Перед замовленням звірте наявність отвору під повторювач повороту.",
      checkFit,
    ],
  },
  {
    categoryId: "kapoty",
    noun: "Капот",
    brandIds: ["signeda", "klokkerholm", "depo"],
    price: [4000, 20000],
    universal: false,
    warrantyMonths: 6,
    specs: [
      { name: "Матеріал", pick: ["сталь", "алюміній"] },
      { name: "Під фарбування", pick: ["так"] },
      { name: "Шумоізоляція", pick: ["передбачено місце", "без шумоізоляції"] },
      { name: "Отвори під омивач", pick: ["так", "ні"] },
    ],
    descriptions: [
      "Капот {brand} для {vehicle}. Постачається незабарвленим, під фарбування.",
      "Матеріал — {spec:Матеріал}. Петлі, замок, шумоізоляція й форсунки омивача переставляються зі старого капота.",
      checkFit,
    ],
  },
  {
    categoryId: "dzerkala",
    noun: "Дзеркало бокове",
    brandIds: ["depo", "signeda", "klokkerholm", "hella"],
    price: [900, 6500],
    universal: false,
    warrantyMonths: 12,
    option: sideN,
    specs: [
      { name: "Підігрів", pick: ["так", "ні"] },
      { name: "Регулювання", pick: ["електричне", "механічне"] },
      { name: "Покажчик повороту", pick: ["вбудований", "без покажчика"] },
      { name: "Корпус", pick: ["під фарбування", "чорний"] },
    ],
    descriptions: [
      "Бокове дзеркало {brand} для {vehicle} у зборі. Оберіть сторону у картці товару.",
      "{spec:Регулювання} регулювання, підігрів — {spec:Підігрів}. Звірте кількість контактів роз'єму з вашою комплектацією.",
      checkFit,
    ],
  },
  {
    categoryId: "reshitky-radiatora",
    noun: "Решітка радіатора",
    brandIds: ["signeda", "klokkerholm", "depo"],
    price: [700, 5500],
    universal: false,
    warrantyMonths: 6,
    specs: [
      { name: "Колір", pick: ["чорний", "під фарбування", "чорний із хромом"] },
      { name: "Матеріал", pick: ["ABS-пластик"] },
      { name: "Місце під емблему", pick: ["так"] },
      { name: "Під камеру/радар", pick: ["так", "ні"] },
    ],
    descriptions: [
      "Решітка радіатора {brand} для {vehicle}.",
      "Колір — «{spec:Колір}». Емблема й хромовані накладки переставляються зі штатної решітки або замовляються окремо.",
      checkFit,
    ],
  },

  // ── Вихлопна система ────────────────────────────────────
  {
    categoryId: "hlushnyky",
    noun: "Глушник",
    brandIds: ["bosal", "walker", "polmostrow"],
    price: [1200, 7000],
    universal: false,
    warrantyMonths: 12,
    specs: [
      { name: "Розташування", pick: ["задня частина (банка)", "середня частина (резонатор)"] },
      { name: "Матеріал", pick: ["алюмінізована сталь", "нержавіюча сталь"] },
      { name: "Кількість патрубків", pick: ["1", "2"] },
      { name: "Кріплення в комплекті", pick: ["так", "ні"] },
    ],
    descriptions: [
      "Глушник {brand} для {vehicle}, {spec:Розташування}.",
      "Матеріал — {spec:Матеріал}. Для монтажу можуть знадобитися нові хомути та гумові підвіси.",
      checkFit,
    ],
  },
  {
    categoryId: "katalizatory",
    noun: "Каталізатор",
    brandIds: ["bosal", "walker", "polmostrow"],
    price: [6000, 30000],
    universal: false,
    warrantyMonths: 12,
    engineNote: true,
    specs: [
      { name: "Тип блока", pick: ["керамічний", "металевий"] },
      { name: "Екологічний клас", pick: ["Євро-4", "Євро-5"] },
      { name: "Діаметр входу", pick: ["50 мм", "55 мм", "60 мм"] },
      { name: "Місце під лямбда-зонд", pick: ["так"] },
    ],
    descriptions: [
      "Каталізатор {brand} для {vehicle}, {spec:Екологічний клас}.",
      "Блок — «{spec:Тип блока}». Передчасне руйнування каталізатора часто пов'язане з несправностями запалювання чи паливної системи — варто усунути причину.",
      checkFit,
    ],
  },
  {
    categoryId: "hofry-hlushnyka",
    noun: "Гофра глушника",
    brandIds: ["bosal", "walker", "polmostrow"],
    price: [350, 1600],
    universal: false,
    warrantyMonths: 6,
    specs: [
      { name: "Внутрішній діаметр", pick: ["45 мм", "50 мм", "55 мм", "60 мм", "65 мм"] },
      { name: "Довжина", num: [100, 200], step: 10, unit: "мм" },
      { name: "Виконання", pick: ["з обплетенням (interlock)", "триконусна"] },
      { name: "Матеріал", pick: ["нержавіюча сталь"] },
    ],
    descriptions: [
      "Гофра приймальної труби {brand} для {vehicle}, діаметр {spec:Внутрішній діаметр}.",
      "Виконання — «{spec:Виконання}». Гофра компенсує вібрації двигуна й теплове розширення вихлопної системи.",
      checkFit,
    ],
  },
  {
    categoryId: "liambda-zondy",
    noun: "Лямбда-зонд",
    brandIds: ["bosch", "ngk", "denso", "hella"],
    price: [900, 5500],
    universal: false,
    warrantyMonths: 12,
    engineNote: true,
    specs: [
      { name: "Призначення", pick: ["регулювальний (до каталізатора)", "діагностичний (після каталізатора)"] },
      { name: "Кількість контактів", pick: ["1", "2", "3", "4", "5"] },
      { name: "Тип", pick: ["цирконієвий", "широкосмуговий"] },
      { name: "Довжина кабелю", num: [300, 900], step: 10, unit: "мм" },
    ],
    descriptions: [
      "Лямбда-зонд (кисневий датчик) {brand} для {vehicle}, {spec:Призначення}.",
      "{spec:Кількість контактів}-контактний роз'єм. Несправність датчика підвищує витрату пального й погіршує роботу двигуна.",
      checkFit,
    ],
  },

  // ── Оливи та автохімія ──────────────────────────────────
  {
    categoryId: "motorni-olyvy",
    noun: "Моторна олива",
    brandIds: ["castrol", "motul", "liqui-moly"],
    price: [850, 2400],
    universal: true,
    warrantyMonths: 0,
    lines: {
      castrol: ["Edge", "Magnatec", "GTX"],
      motul: ["8100", "6100", "Specific"],
      "liqui-moly": ["Top Tec", "Special Tec", "Molygen"],
    },
    nameSpecs: ["В'язкість"],
    option: {
      name: "Об'єм",
      values: [
        { label: "1 л", key: "1l", priceDelta: -450 },
        { label: "4 л", key: "4l", priceDelta: 0 },
        { label: "5 л", key: "5l", priceDelta: 420 },
      ],
      defaultIndex: 1,
      appendToName: true,
    },
    specs: [
      { name: "В'язкість", pick: ["0W-20", "5W-30", "5W-40", "10W-40"] },
      { name: "Основа", pick: ["синтетична", "напівсинтетична"] },
      { name: "Стандарт ACEA", pick: ["A3/B4", "C2", "C3"] },
      { name: "Допуск", pick: ["VW 504 00/507 00", "MB 229.51", "dexos2", "BMW LL-04"] },
    ],
    descriptions: [
      "Моторна олива {brand} {spec:В'язкість}, {spec:Основа} основа. Базова ціна — за каністру 4 л; обсяг обирайте у картці товару.",
      "Відповідає {spec:Стандарт ACEA} та допуску {spec:Допуск}. Завжди звіряйте в'язкість і допуск із сервісною книжкою авто.",
      checkUniversal,
    ],
  },
  {
    categoryId: "transmisiini-olyvy",
    noun: "Трансмісійна олива",
    brandIds: ["castrol", "motul", "liqui-moly"],
    price: [280, 950],
    universal: true,
    warrantyMonths: 0,
    lines: {
      castrol: ["Transmax", "Syntrans"],
      motul: ["Gear", "Multi ATF"],
      "liqui-moly": ["Top Tec ATF", "GL5"],
    },
    nameSpecs: ["В'язкість"],
    option: {
      name: "Об'єм",
      values: [
        { label: "1 л", key: "1l", priceDelta: 0 },
        { label: "4 л", key: "4l", priceDelta: 950 },
      ],
      defaultIndex: 0,
      appendToName: true,
    },
    specs: [
      { name: "В'язкість", pick: ["75W-80", "75W-90", "80W-90", "ATF"] },
      { name: "Тип КПП", pick: ["механічна", "автоматична"] },
      { name: "Специфікація", pick: ["API GL-4", "API GL-5", "ATF Dexron VI"] },
      { name: "Основа", pick: ["синтетична"] },
    ],
    descriptions: [
      "Трансмісійна олива {brand} {spec:В'язкість} для {spec:Тип КПП} коробки передач. Базова ціна — за 1 л.",
      "Специфікація {spec:Специфікація}. Тип рідини для АКПП підбирайте строго за вимогами виробника — помилка може зашкодити коробці.",
      checkUniversal,
    ],
  },
  {
    categoryId: "antyfryzy",
    noun: "Антифриз",
    brandIds: ["liqui-moly", "motul", "febi-bilstein"],
    price: [160, 620],
    universal: true,
    warrantyMonths: 0,
    nameSpecs: ["Тип"],
    option: {
      name: "Об'єм",
      values: [
        { label: "1 л", key: "1l", priceDelta: 0 },
        { label: "5 л", key: "5l", priceDelta: 880 },
      ],
      defaultIndex: 0,
      appendToName: true,
    },
    specs: [
      { name: "Тип", pick: ["G11", "G12+", "G12++", "G13"] },
      { name: "Колір", pick: ["синій", "червоний", "рожевий", "фіолетовий"] },
      { name: "Стан", pick: ["концентрат", "готовий розчин"] },
      { name: "Температура замерзання", pick: ["-37 °C", "-40 °C"] },
    ],
    descriptions: [
      "Антифриз {brand} класу {spec:Тип}, колір — {spec:Колір}. Базова ціна за 1 л.",
      "Постачається як «{spec:Стан}». Не змішуйте антифризи різних типів; використовуйте рідину, сумісну з системою охолодження авто.",
      checkUniversal,
    ],
  },
  {
    categoryId: "halmivna-ridyna",
    noun: "Гальмівна рідина",
    brandIds: ["ate", "bosch", "liqui-moly", "motul"],
    price: [160, 420],
    universal: true,
    warrantyMonths: 0,
    nameSpecs: ["Клас"],
    option: {
      name: "Об'єм",
      values: [
        { label: "0.5 л", key: "05l", priceDelta: 0 },
        { label: "1 л", key: "1l", priceDelta: 180 },
      ],
      defaultIndex: 0,
      appendToName: true,
    },
    specs: [
      { name: "Клас", pick: ["DOT 3", "DOT 4", "DOT 4 Class 6", "DOT 5.1"] },
      { name: "Температура кипіння (сухої)", pick: ["230 °C", "265 °C", "270 °C"] },
      { name: "Основа", pick: ["гліколева"] },
      { name: "Стандарт", pick: ["ISO 4925", "FMVSS 116 DOT 4", "SAE J1704"] },
    ],
    descriptions: [
      "Гальмівна рідина {brand} {spec:Клас}. Базова ціна за 0.5 л.",
      "Температура кипіння сухої рідини — {spec:Температура кипіння (сухої)}. Рідина гігроскопічна, тож її міняють раз на 2 роки незалежно від пробігу.",
      checkUniversal,
    ],
  },
  {
    categoryId: "avtokosmetyka",
    noun: "Автохімія",
    brandIds: ["liqui-moly", "motul", "elegant"],
    price: [120, 1200],
    universal: true,
    warrantyMonths: 0,
    subtypes: [
      "Очисник двигуна",
      "Очисник гальм",
      "Засіб для чорніння гуми",
      "Поліроль для пластику",
      "Антидощ для скла",
      "Універсальне мастило-спрей",
    ],
    nameSpecs: ["Об'єм"],
    specs: [
      { name: "Об'єм", pick: ["250 мл", "400 мл", "500 мл", "1 л"] },
      { name: "Форма випуску", pick: ["аерозоль", "флакон", "тригер"] },
      { name: "Призначення", pick: ["очищення", "догляд", "захист"] },
      { name: "Спосіб застосування", pick: ["без змивання", "змити водою", "розпилити та протерти"] },
    ],
    descriptions: [
      "{noun} {brand}, {spec:Об'єм}. Форма випуску — {spec:Форма випуску}.",
      "Засіб для {spec:Призначення} під час планового догляду за автомобілем. Перед застосуванням ознайомтеся з інструкцією на упаковці.",
      checkUniversal,
    ],
  },

  // ── Аксесуари ───────────────────────────────────────────
  {
    categoryId: "kylymky",
    noun: "Килимки в салон",
    brandIds: ["stingray", "elegant", "beltex"],
    price: [600, 3500],
    universal: false,
    warrantyMonths: 12,
    specs: [
      { name: "Матеріал", pick: ["гума", "EVA (ромб)", "поліуретан", "текстиль"] },
      { name: "Комплектність", pick: ["4 шт (повний комплект)"] },
      { name: "Бортик", pick: ["високий", "стандартний"] },
      { name: "Кріплення", pick: ["штатні фіксатори", "універсальні"] },
    ],
    descriptions: [
      "Комплект килимків у салон {brand} для {vehicle}. Виготовлені за формою підлоги конкретної моделі.",
      "Матеріал — {spec:Матеріал}, {spec:Бортик} бортик утримує вологу й бруд. У комплекті 4 килимки.",
      checkFit,
    ],
  },
  {
    categoryId: "shchitky-sklochysnyka",
    noun: "Щітка склоочисника",
    brandIds: ["bosch", "valeo", "denso"],
    price: [160, 650],
    universal: true,
    warrantyMonths: 6,
    lines: {
      bosch: ["Aerotwin", "Eco", "Twin"],
      valeo: ["Silencio", "First"],
      denso: ["Hybrid", "Wiper Blade"],
    },
    option: {
      name: "Довжина",
      values: [
        { label: "400 мм", key: "400", priceDelta: 0 },
        { label: "480 мм", key: "480", priceDelta: 20 },
        { label: "530 мм", key: "530", priceDelta: 30 },
        { label: "600 мм", key: "600", priceDelta: 50 },
        { label: "650 мм", key: "650", priceDelta: 70 },
      ],
      defaultIndex: 2,
    },
    specs: [
      { name: "Тип", pick: ["безкаркасна", "каркасна", "гібридна"] },
      { name: "Кріплення", pick: ["гачок (hook)", "push button", "байонет"] },
      { name: "Зимове виконання", pick: ["так", "ні"] },
      { name: "Матеріал чистика", pick: ["натуральна гума", "графітове напилення", "силікон"] },
    ],
    descriptions: [
      "Щітка склоочисника {brand}, тип «{spec:Тип}». Довжину обирайте у картці товару — ціна залежить від розміру.",
      "Кріплення — «{spec:Кріплення}». Щітки доцільно міняти парою; для деяких авто водійська й пасажирська різної довжини.",
      checkUniversal,
    ],
  },
  {
    categoryId: "deflektory-vikon",
    noun: "Дефлектори вікон",
    brandIds: ["heko", "elegant", "stingray"],
    price: [400, 2200],
    universal: false,
    warrantyMonths: 12,
    specs: [
      { name: "Матеріал", pick: ["акрил", "полікарбонат"] },
      { name: "Комплектність", pick: ["4 шт", "2 шт (передні)"] },
      { name: "Кріплення", pick: ["на скотч 3M", "у віконний проріз"] },
      { name: "Колір", pick: ["димчастий"] },
    ],
    descriptions: [
      "Дефлектори вікон (вітровики) {brand} для {vehicle}. Дозволяють залишати вікна прочиненими в дощ.",
      "Матеріал — {spec:Матеріал}, кріплення «{spec:Кріплення}». У комплекті — {spec:Комплектність}.",
      checkFit,
    ],
  },
  {
    categoryId: "bahazhnyky-na-dakh",
    noun: "Багажник на дах",
    brandIds: ["thule", "amos", "aguri"],
    price: [1800, 9500],
    universal: true,
    warrantyMonths: 24,
    lines: {
      thule: ["WingBar Evo", "SquareBar Evo", "SlideBar"],
      amos: ["Alfa", "Dromader"],
      aguri: ["Runner", "Prestige"],
    },
    specs: [
      { name: "Тип поперечин", pick: ["аеродинамічні", "прямокутні", "сталеві"] },
      { name: "Тип кріплення", pick: ["за рейлінги", "за штатні точки", "у дверний проріз"] },
      { name: "Макс. навантаження", pick: ["75 кг", "90 кг", "100 кг"] },
      { name: "Матеріал", pick: ["алюміній", "сталь"] },
    ],
    descriptions: [
      "Багажна система на дах {brand}: дві поперечини з кріпленням. Тип поперечин — «{spec:Тип поперечин}».",
      "Кріплення «{spec:Тип кріплення}», максимальне навантаження {spec:Макс. навантаження}. Під конкретне авто може знадобитися монтажний кіт — уточнюйте перед замовленням.",
      checkUniversal,
    ],
  },
  {
    categoryId: "chokhly-na-sydinnia",
    noun: "Чохли на сидіння",
    brandIds: ["beltex", "elegant", "stingray"],
    price: [900, 5500],
    universal: true,
    warrantyMonths: 12,
    lines: {
      beltex: ["Comfort", "Cocit", "Polo"],
      elegant: ["Classic", "Maxi", "Plus"],
      stingray: ["Standard"],
    },
    specs: [
      { name: "Матеріал", pick: ["екошкіра", "поліестер", "велюр"] },
      { name: "Комплектність", pick: ["передні (2 шт)", "повний комплект"] },
      { name: "Виріз під підголівники", pick: ["так"] },
      { name: "Сумісність з airbag", pick: ["так", "ні"] },
    ],
    descriptions: [
      "Чохли на сидіння {brand}, матеріал — {spec:Матеріал}. Універсальний крій підходить до більшості легкових авто.",
      "Комплектність — «{spec:Комплектність}». Перед замовленням звірте тип сидінь (суцільні/роздільні) та наявність бічних подушок безпеки.",
      checkUniversal,
    ],
  },
];
