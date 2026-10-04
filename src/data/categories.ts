import type { Category } from "@/lib/types";

type TopCategory = {
  slug: string;
  name: string;
  icon: string;
  description: string;
  children: [slug: string, name: string][];
};

const tree: TopCategory[] = [
  {
    slug: "halmivna-systema",
    name: "Гальмівна система",
    icon: "brakes",
    description: "Колодки, диски, супорти та датчики для впевненого гальмування в будь-яку погоду.",
    children: [
      ["halmivni-kolodky", "Гальмівні колодки"],
      ["halmivni-dysky", "Гальмівні диски"],
      ["halmivni-suporty", "Гальмівні супорти"],
      ["halmivni-shlanhy", "Гальмівні шланги"],
      ["datchyky-abs", "Датчики ABS"],
    ],
  },
  {
    slug: "dvyhun",
    name: "Двигун",
    icon: "engine",
    description: "Комплекти ГРМ, запалювання, прокладки та опори — усе для ресурсу й тяги мотора.",
    children: [
      ["komplekty-hrm", "Комплекти ГРМ"],
      ["svichky-zapaliuvannia", "Свічки запалювання"],
      ["kotushky-zapaliuvannia", "Котушки запалювання"],
      ["prokladky-dvyhuna", "Прокладки двигуна"],
      ["vodiani-pompy", "Водяні помпи"],
      ["opory-dvyhuna", "Опори двигуна"],
    ],
  },
  {
    slug: "filtry",
    name: "Фільтри",
    icon: "filters",
    description: "Масляні, повітряні, паливні та салонні фільтри для планового ТО.",
    children: [
      ["masliani-filtry", "Масляні фільтри"],
      ["povitriani-filtry", "Повітряні фільтри"],
      ["palyvni-filtry", "Паливні фільтри"],
      ["filtry-salonu", "Фільтри салону"],
    ],
  },
  {
    slug: "pidviska-ta-rulove",
    name: "Підвіска та рульове",
    icon: "suspension",
    description: "Амортизатори, важелі, опори й наконечники, що повертають авто керованість.",
    children: [
      ["amortyzatory", "Амортизатори"],
      ["pruzhyny-pidvisky", "Пружини підвіски"],
      ["vazheli-pidvisky", "Важелі підвіски"],
      ["kulovi-opory", "Кульові опори"],
      ["stiiky-stabilizatora", "Стійки стабілізатора"],
      ["rulovi-nakonechnyky", "Рульові наконечники"],
      ["pidshypnyky-matochyny", "Підшипники маточини"],
    ],
  },
  {
    slug: "transmisiia",
    name: "Трансмісія",
    icon: "transmission",
    description: "Зчеплення, ШРУСи, півосі та маховики для плавного передавання моменту.",
    children: [
      ["komplekty-zcheplennia", "Комплекти зчеплення"],
      ["shrusy", "ШРУСи"],
      ["pivosi", "Півосі"],
      ["makhovyky", "Маховики"],
    ],
  },
  {
    slug: "elektryka",
    name: "Електрика",
    icon: "electrics",
    description: "Акумулятори, генератори, стартери та датчики для впевненого запуску.",
    children: [
      ["akumuliatory", "Акумулятори"],
      ["heneratory", "Генератори"],
      ["startery", "Стартери"],
      ["datchyky-dvyhuna", "Датчики двигуна"],
      ["svichky-rozzharennia", "Свічки розжарювання"],
    ],
  },
  {
    slug: "osvitlennia",
    name: "Освітлення",
    icon: "lighting",
    description: "Фари, ліхтарі та автолампи, щоб бачити дорогу й бути помітним.",
    children: [
      ["fary", "Фари"],
      ["zadni-likhtari", "Задні ліхтарі"],
      ["avtolampy", "Автолампи"],
      ["protytumanni-fary", "Протитуманні фари"],
    ],
  },
  {
    slug: "okholodzhennia-ta-klimat",
    name: "Охолодження та клімат",
    icon: "cooling",
    description: "Радіатори, термостати, вентилятори й компресори кондиціонера.",
    children: [
      ["radiatory-okholodzhennia", "Радіатори охолодження"],
      ["termostaty", "Термостати"],
      ["ventyliatory-radiatora", "Вентилятори радіатора"],
      ["kompresory-kondytsionera", "Компресори кондиціонера"],
    ],
  },
  {
    slug: "kuzovni-detali",
    name: "Кузовні деталі",
    icon: "body",
    description: "Бампери, крила, капоти, дзеркала та решітки для відновлення кузова.",
    children: [
      ["bampery", "Бампери"],
      ["kryla", "Крила"],
      ["kapoty", "Капоти"],
      ["dzerkala", "Дзеркала"],
      ["reshitky-radiatora", "Решітки радіатора"],
    ],
  },
  {
    slug: "vykhlopna-systema",
    name: "Вихлопна система",
    icon: "exhaust",
    description: "Глушники, каталізатори, гофри та лямбда-зонди.",
    children: [
      ["hlushnyky", "Глушники"],
      ["katalizatory", "Каталізатори"],
      ["hofry-hlushnyka", "Гофри глушника"],
      ["liambda-zondy", "Лямбда-зонди"],
    ],
  },
  {
    slug: "olyvy-ta-avtokhimiia",
    name: "Оливи та автохімія",
    icon: "fluids",
    description: "Моторні й трансмісійні оливи, антифризи, гальмівна рідина та догляд за авто.",
    children: [
      ["motorni-olyvy", "Моторні оливи"],
      ["transmisiini-olyvy", "Трансмісійні оливи"],
      ["antyfryzy", "Антифризи"],
      ["halmivna-ridyna", "Гальмівна рідина"],
      ["avtokosmetyka", "Автокосметика"],
    ],
  },
  {
    slug: "aksesuary",
    name: "Аксесуари",
    icon: "accessories",
    description: "Килимки, щітки склоочисника, дефлектори, багажники та чохли.",
    children: [
      ["kylymky", "Автокилимки"],
      ["shchitky-sklochysnyka", "Щітки склоочисника"],
      ["deflektory-vikon", "Дефлектори вікон"],
      ["bahazhnyky-na-dakh", "Багажники на дах"],
      ["chokhly-na-sydinnia", "Чохли на сидіння"],
    ],
  },
];

/**
 * Flat category list: 12 top-level groups followed by their leaf categories.
 * The illustration key of a leaf equals its slug; a group reuses its first leaf.
 */
export const categories: Category[] = tree.flatMap((top) => [
  {
    id: top.slug,
    slug: top.slug,
    name: top.name,
    parentId: null,
    illustration: top.children[0][0],
    icon: top.icon,
    description: top.description,
  },
  ...top.children.map(([slug, name]) => ({
    id: slug,
    slug,
    name,
    parentId: top.slug,
    illustration: slug,
  })),
]);
