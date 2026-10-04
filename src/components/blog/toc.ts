import type { ArticleBlock } from "@/lib/types";

/** Ukrainian → latin, enough to turn an h2 heading into a stable anchor id. */
const translit: Record<string, string> = {
  а: "a", б: "b", в: "v", г: "h", ґ: "g", д: "d", е: "e", є: "ie", ж: "zh",
  з: "z", и: "y", і: "i", ї: "i", й: "i", к: "k", л: "l", м: "m", н: "n",
  о: "o", п: "p", р: "r", с: "s", т: "t", у: "u", ф: "f", х: "kh", ц: "ts",
  ч: "ch", ш: "sh", щ: "shch", ь: "", ю: "iu", я: "ia",
};

/** "Склад фрикційної суміші" → "sklad-fryktsiinoi-sumishi" */
export function slugifyHeading(text: string): string {
  const slug = text
    .toLowerCase()
    .replace(/['’ʼ]/g, "")
    .split("")
    .map((ch) => (ch in translit ? translit[ch] : ch))
    .join("")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "rozdil";
}

export interface TocEntry {
  id: string;
  text: string;
}

/**
 * Ordered table of contents from the h2 blocks, with de-duplicated ids.
 * The nth h2 in the body corresponds to the nth entry here, so the article
 * body and the «Зміст» stay in sync when both call this on the same body.
 */
export function buildToc(body: ArticleBlock[]): TocEntry[] {
  const seen = new Map<string, number>();
  const entries: TocEntry[] = [];
  for (const block of body) {
    if (block.type !== "h2") continue;
    const base = slugifyHeading(block.text);
    const used = seen.get(base) ?? 0;
    seen.set(base, used + 1);
    entries.push({ id: used === 0 ? base : `${base}-${used + 1}`, text: block.text });
  }
  return entries;
}
