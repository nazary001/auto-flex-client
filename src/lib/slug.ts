/*
 * URL slugs and search folding shared by the catalog, the supplier sync and the admin.
 * Cyrillic is transliterated with the Ukrainian passport scheme (г → h, и → y, …).
 */

const translit: Record<string, string> = {
  а: "a", б: "b", в: "v", г: "h", ґ: "g", д: "d", е: "e", є: "ie", ж: "zh",
  з: "z", и: "y", і: "i", ї: "i", й: "i", к: "k", л: "l", м: "m", н: "n",
  о: "o", п: "p", р: "r", с: "s", т: "t", у: "u", ф: "f", х: "kh", ц: "ts",
  ч: "ch", ш: "sh", щ: "shch", ь: "", ю: "iu", я: "ia", ъ: "", ы: "y", э: "e", ё: "e",
  š: "s", ž: "z", č: "c", ć: "c", ö: "o", ü: "u", ä: "a", ë: "e", é: "e", è: "e",
  á: "a", à: "a", â: "a", í: "i", ó: "o", ú: "u", ñ: "n", ç: "c", ã: "a", õ: "o", ı: "i", ğ: "g", ş: "s",
};

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .split("")
    .map((ch) => translit[ch] ?? ch)
    .join("")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-+/g, "-");
}

/** Part numbers are compared without spaces, dots and hyphens */
export function normalizeCode(value: string): string {
  return value.toLowerCase().replace(/[\s.\-]/g, "");
}

/** Lower-case, strip diacritics and unify apostrophes — so "skoda" finds "Škoda" */
export function fold(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[’ʼ`]/g, "'");
}

export function tokenize(query: string): string[] {
  return fold(query).split(/\s+/).filter(Boolean);
}

/** Stable 32-bit hash for deterministic jitter (popularity, demo data) */
export function hashString(value: string): number {
  let h = 2166136261;
  for (let i = 0; i < value.length; i++) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
