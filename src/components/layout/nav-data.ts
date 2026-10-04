/**
 * Plain, serialisable navigation data passed from the server <Header> to its
 * client islands (catalog mega-menu, mobile drawer). No runtime imports here so
 * the interfaces are safe to `import type` from Client Components without pulling
 * the catalog into the browser bundle.
 */

export interface NavSub {
  slug: string;
  name: string;
}

export interface NavGroup {
  slug: string;
  name: string;
  /** CategoryIcon key */
  icon?: string;
  /** Illustration file name in /public/illustrations */
  illustration: string;
  description?: string;
  /** Number of products in the whole group */
  count: number;
  subs: NavSub[];
}

export interface NavMake {
  slug: string;
  name: string;
}

export interface NavData {
  groups: NavGroup[];
  popularMakes: NavMake[];
}
