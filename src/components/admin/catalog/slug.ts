/*
 * Transliterating slugifier for the catalog admin. Client-safe (no server imports), so the
 * product / category / brand forms can preview a slug as the name is typed and the server
 * actions can derive one when it is left blank. Mirrors the rules of the static demo data:
 * Ukrainian + common Latin diacritics → ASCII, everything else → single hyphens.
 */

const translit: Record<string, string> = {
  а: "a", б: "b", в: "v", г: "h", ґ: "g", д: "d", е: "e", є: "ie", ж: "zh",
  з: "z", и: "y", і: "i", ї: "i", й: "i", к: "k", л: "l", м: "m", н: "n",
  о: "o", п: "p", р: "r", с: "s", т: "t", у: "u", ф: "f", х: "kh", ц: "ts",
  ч: "ch", ш: "sh", щ: "shch", ь: "", ю: "iu", я: "ia", ъ: "", ы: "y", э: "e", ё: "e",
  š: "s", ž: "z", č: "c", ć: "c", ö: "o", ü: "u", ä: "a", ë: "e", é: "e", è: "e",
  á: "a", à: "a", â: "a", í: "i", ó: "o", ú: "u", ñ: "n", ç: "c", ã: "a", õ: "o",
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
