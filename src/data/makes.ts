import type { CarModel, Make } from "@/lib/types";

/**
 * Makes popular on the Ukrainian used-car market and their generations.
 * Make `id` equals `slug`. Model `id` is `${makeId}-${modelSlug}`; model slugs are
 * unique within a make. `yearTo === null` means the generation is still produced.
 * Bodies are in Ukrainian. Years are real production spans for each generation.
 */
type MakeRow = [id: string, name: string, country: string, popular: boolean];

const makeRows: MakeRow[] = [
  ["audi", "Audi", "Німеччина", true],
  ["bmw", "BMW", "Німеччина", true],
  ["mercedes-benz", "Mercedes-Benz", "Німеччина", true],
  ["volkswagen", "Volkswagen", "Німеччина", true],
  ["skoda", "Škoda", "Чехія", true],
  ["seat", "SEAT", "Іспанія", false],
  ["opel", "Opel", "Німеччина", true],
  ["ford", "Ford", "США", true],
  ["renault", "Renault", "Франція", true],
  ["dacia", "Dacia", "Румунія", false],
  ["peugeot", "Peugeot", "Франція", false],
  ["citroen", "Citroën", "Франція", false],
  ["fiat", "Fiat", "Італія", false],
  ["toyota", "Toyota", "Японія", true],
  ["lexus", "Lexus", "Японія", false],
  ["honda", "Honda", "Японія", false],
  ["nissan", "Nissan", "Японія", true],
  ["mazda", "Mazda", "Японія", false],
  ["mitsubishi", "Mitsubishi", "Японія", false],
  ["subaru", "Subaru", "Японія", false],
  ["suzuki", "Suzuki", "Японія", false],
  ["hyundai", "Hyundai", "Південна Корея", true],
  ["kia", "Kia", "Південна Корея", true],
  ["chevrolet", "Chevrolet", "США", false],
  ["daewoo", "Daewoo", "Південна Корея", false],
  ["volvo", "Volvo", "Швеція", false],
];

export const makes: Make[] = makeRows.map(([id, name, country, popular]) => ({
  id,
  slug: id,
  name,
  country,
  ...(popular ? { popular: true } : {}),
}));

type ModelRow = [name: string, slug: string, yearFrom: number, yearTo: number | null, body: string];

const modelsByMake: Record<string, ModelRow[]> = {
  audi: [
    ["A3 8P", "a3-8p", 2003, 2013, "хетчбек"],
    ["A3 8V", "a3-8v", 2012, 2020, "хетчбек"],
    ["A4 B8", "a4-b8", 2007, 2015, "седан"],
    ["A4 B9", "a4-b9", 2015, 2023, "седан"],
    ["A6 C7", "a6-c7", 2011, 2018, "седан"],
    ["Q5 8R", "q5-8r", 2008, 2017, "кросовер"],
  ],
  bmw: [
    ["3 Series E90", "3-e90", 2005, 2013, "седан"],
    ["3 Series F30", "3-f30", 2011, 2019, "седан"],
    ["5 Series E60", "5-e60", 2003, 2010, "седан"],
    ["5 Series F10", "5-f10", 2010, 2017, "седан"],
    ["X5 E70", "x5-e70", 2006, 2013, "кросовер"],
  ],
  "mercedes-benz": [
    ["C-Class W204", "c-w204", 2007, 2014, "седан"],
    ["C-Class W205", "c-w205", 2014, 2021, "седан"],
    ["E-Class W212", "e-w212", 2009, 2016, "седан"],
    ["Sprinter W906", "sprinter-w906", 2006, 2018, "фургон"],
    ["Vito W639", "vito-w639", 2003, 2014, "мінівен"],
  ],
  volkswagen: [
    ["Golf VI", "golf-vi", 2008, 2013, "хетчбек"],
    ["Golf VII", "golf-vii", 2012, 2020, "хетчбек"],
    ["Passat B7", "passat-b7", 2010, 2015, "седан"],
    ["Passat B8", "passat-b8", 2014, 2023, "седан"],
    ["Polo V", "polo-v", 2009, 2017, "хетчбек"],
    ["Tiguan I", "tiguan-i", 2007, 2016, "кросовер"],
  ],
  skoda: [
    ["Octavia A5", "octavia-a5", 2004, 2013, "ліфтбек"],
    ["Octavia A7", "octavia-a7", 2012, 2020, "ліфтбек"],
    ["Octavia A8", "octavia-a8", 2019, null, "ліфтбек"],
    ["Fabia II", "fabia-ii", 2007, 2014, "хетчбек"],
    ["Superb II", "superb-ii", 2008, 2015, "ліфтбек"],
    ["Rapid", "rapid", 2012, 2019, "ліфтбек"],
  ],
  seat: [
    ["Leon II 1P", "leon-ii", 2005, 2012, "хетчбек"],
    ["Leon III 5F", "leon-iii", 2012, 2020, "хетчбек"],
    ["Ibiza 6J", "ibiza-6j", 2008, 2017, "хетчбек"],
    ["Toledo IV", "toledo-iv", 2012, 2019, "ліфтбек"],
  ],
  opel: [
    ["Astra H", "astra-h", 2004, 2014, "хетчбек"],
    ["Astra J", "astra-j", 2009, 2015, "хетчбек"],
    ["Astra K", "astra-k", 2015, 2021, "хетчбек"],
    ["Insignia A", "insignia-a", 2008, 2017, "ліфтбек"],
    ["Corsa D", "corsa-d", 2006, 2014, "хетчбек"],
    ["Vivaro A", "vivaro-a", 2001, 2014, "фургон"],
  ],
  ford: [
    ["Focus II", "focus-ii", 2004, 2011, "хетчбек"],
    ["Focus III", "focus-iii", 2010, 2018, "хетчбек"],
    ["Fiesta VI", "fiesta-vi", 2008, 2017, "хетчбек"],
    ["Mondeo IV", "mondeo-iv", 2007, 2014, "ліфтбек"],
    ["Transit VII", "transit-vii", 2006, 2014, "фургон"],
    ["Kuga II", "kuga-ii", 2012, 2019, "кросовер"],
  ],
  renault: [
    ["Megane II", "megane-ii", 2002, 2009, "хетчбек"],
    ["Megane III", "megane-iii", 2008, 2016, "хетчбек"],
    ["Logan I", "logan-i", 2004, 2012, "седан"],
    ["Duster I", "duster-i", 2010, 2017, "кросовер"],
    ["Kangoo II", "kangoo-ii", 2008, 2021, "фургон"],
    ["Trafic II", "trafic-ii", 2001, 2014, "фургон"],
  ],
  dacia: [
    ["Logan I", "logan-i", 2004, 2012, "седан"],
    ["Sandero I", "sandero-i", 2008, 2012, "хетчбек"],
    ["Duster I", "duster-i", 2010, 2017, "кросовер"],
    ["Logan II", "logan-ii", 2012, 2020, "седан"],
  ],
  peugeot: [
    ["307", "307", 2001, 2008, "хетчбек"],
    ["308 T7", "308-t7", 2007, 2013, "хетчбек"],
    ["308 T9", "308-t9", 2013, 2021, "хетчбек"],
    ["407", "407", 2004, 2010, "седан"],
    ["Partner II", "partner-ii", 2008, 2018, "фургон"],
  ],
  citroen: [
    ["C4 I", "c4-i", 2004, 2010, "хетчбек"],
    ["C4 II", "c4-ii", 2010, 2018, "хетчбек"],
    ["C5 II", "c5-ii", 2008, 2017, "седан"],
    ["Berlingo II", "berlingo-ii", 2008, 2018, "фургон"],
  ],
  fiat: [
    ["Doblo II", "doblo-ii", 2010, 2022, "фургон"],
    ["Punto III", "punto-iii", 2005, 2018, "хетчбек"],
    ["Ducato III", "ducato-iii", 2006, null, "фургон"],
    ["500", "500", 2007, null, "хетчбек"],
  ],
  toyota: [
    ["Corolla E150", "corolla-e150", 2006, 2013, "седан"],
    ["Corolla E170", "corolla-e170", 2013, 2019, "седан"],
    ["Camry XV40", "camry-xv40", 2006, 2011, "седан"],
    ["Camry XV50", "camry-xv50", 2011, 2017, "седан"],
    ["RAV4 XA30", "rav4-xa30", 2005, 2013, "кросовер"],
    ["Avensis T27", "avensis-t27", 2008, 2018, "седан"],
  ],
  lexus: [
    ["RX AL10", "rx-al10", 2008, 2015, "кросовер"],
    ["IS XE20", "is-xe20", 2005, 2013, "седан"],
    ["ES XV60", "es-xv60", 2012, 2018, "седан"],
    ["NX I", "nx-i", 2014, 2021, "кросовер"],
  ],
  honda: [
    ["Civic VIII", "civic-viii", 2006, 2012, "хетчбек"],
    ["Accord VIII", "accord-viii", 2008, 2015, "седан"],
    ["CR-V III", "cr-v-iii", 2006, 2012, "кросовер"],
    ["CR-V IV", "cr-v-iv", 2012, 2018, "кросовер"],
  ],
  nissan: [
    ["Qashqai J10", "qashqai-j10", 2006, 2013, "кросовер"],
    ["Qashqai J11", "qashqai-j11", 2013, 2021, "кросовер"],
    ["Juke F15", "juke-f15", 2010, 2019, "кросовер"],
    ["X-Trail T31", "x-trail-t31", 2007, 2014, "кросовер"],
    ["Micra K12", "micra-k12", 2002, 2010, "хетчбек"],
  ],
  mazda: [
    ["3 BK", "3-bk", 2003, 2009, "хетчбек"],
    ["3 BL", "3-bl", 2009, 2013, "хетчбек"],
    ["6 GH", "6-gh", 2007, 2012, "седан"],
    ["CX-5 KE", "cx-5-ke", 2011, 2017, "кросовер"],
  ],
  mitsubishi: [
    ["Lancer IX", "lancer-ix", 2003, 2008, "седан"],
    ["Lancer X", "lancer-x", 2007, 2017, "седан"],
    ["Outlander II", "outlander-ii", 2006, 2012, "кросовер"],
    ["ASX", "asx", 2010, null, "кросовер"],
  ],
  subaru: [
    ["Forester SH", "forester-sh", 2008, 2013, "кросовер"],
    ["Forester SJ", "forester-sj", 2012, 2018, "кросовер"],
    ["Outback BR", "outback-br", 2009, 2014, "універсал"],
    ["Impreza GH", "impreza-gh", 2007, 2011, "хетчбек"],
  ],
  suzuki: [
    ["Swift IV", "swift-iv", 2010, 2017, "хетчбек"],
    ["SX4 I", "sx4-i", 2006, 2014, "кросовер"],
    ["Grand Vitara III", "grand-vitara-iii", 2005, 2015, "кросовер"],
    ["Vitara II", "vitara-ii", 2015, null, "кросовер"],
  ],
  hyundai: [
    ["Accent III", "accent-iii", 2005, 2011, "седан"],
    ["Accent IV", "accent-iv", 2010, 2017, "седан"],
    ["Elantra MD", "elantra-md", 2010, 2015, "седан"],
    ["Tucson LM", "tucson-lm", 2009, 2015, "кросовер"],
    ["Santa Fe CM", "santa-fe-cm", 2006, 2012, "кросовер"],
    ["i30 FD", "i30-fd", 2007, 2012, "хетчбек"],
  ],
  kia: [
    ["Ceed ED", "ceed-ed", 2006, 2012, "хетчбек"],
    ["Ceed JD", "ceed-jd", 2012, 2018, "хетчбек"],
    ["Rio UB", "rio-ub", 2011, 2017, "седан"],
    ["Sportage SL", "sportage-sl", 2010, 2016, "кросовер"],
    ["Sorento XM", "sorento-xm", 2009, 2015, "кросовер"],
    ["Cerato TD", "cerato-td", 2008, 2013, "седан"],
  ],
  chevrolet: [
    ["Aveo T250", "aveo-t250", 2006, 2011, "седан"],
    ["Aveo T300", "aveo-t300", 2011, 2015, "седан"],
    ["Lacetti", "lacetti", 2004, 2013, "седан"],
    ["Cruze", "cruze", 2008, 2016, "седан"],
  ],
  daewoo: [
    ["Lanos", "lanos", 1997, 2017, "седан"],
    ["Nexia", "nexia", 1995, 2016, "седан"],
    ["Matiz", "matiz", 1998, 2015, "хетчбек"],
    ["Sens", "sens", 2002, 2017, "седан"],
  ],
  volvo: [
    ["S60 I", "s60-i", 2000, 2009, "седан"],
    ["S40 II", "s40-ii", 2004, 2012, "седан"],
    ["V50", "v50", 2004, 2012, "універсал"],
    ["XC90 I", "xc90-i", 2002, 2014, "кросовер"],
  ],
};

export const models: CarModel[] = makes.flatMap((make) =>
  (modelsByMake[make.id] ?? []).map(([name, slug, yearFrom, yearTo, body]) => ({
    id: `${make.id}-${slug}`,
    slug,
    makeId: make.id,
    name,
    yearFrom,
    yearTo,
    body,
  })),
);
