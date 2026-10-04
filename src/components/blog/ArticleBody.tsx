import { Lightbulb } from "lucide-react";
import { buildToc } from "@/components/blog/toc";
import { cn } from "@/lib/cn";
import type { ArticleBlock } from "@/lib/types";

/**
 * Renders an article's ArticleBlock[] as styled long-form text (.prose-af).
 * h2 blocks get the same anchor ids as the «Зміст», "tip" becomes a highlighted
 * callout and tables scroll horizontally on narrow screens.
 */
export function ArticleBody({ body, className }: { body: ArticleBlock[]; className?: string }) {
  const toc = buildToc(body);
  let h2Index = 0;

  return (
    <div className={cn("prose-af", className)}>
      {body.map((block, i) => {
        switch (block.type) {
          case "h2": {
            const id = toc[h2Index++]?.id;
            return (
              <h2 key={i} id={id} className="scroll-mt-28">
                {block.text}
              </h2>
            );
          }
          case "h3":
            return <h3 key={i}>{block.text}</h3>;
          case "p":
            return <p key={i}>{block.text}</p>;
          case "ul":
            return (
              <ul key={i}>
                {block.items.map((item, j) => (
                  <li key={j}>{item}</li>
                ))}
              </ul>
            );
          case "ol":
            return (
              <ol key={i}>
                {block.items.map((item, j) => (
                  <li key={j}>{item}</li>
                ))}
              </ol>
            );
          case "tip":
            return (
              <aside key={i} className="rounded-card border border-brand-100 bg-brand-50 p-5">
                <div className="flex gap-3.5">
                  <span className="grid size-9 shrink-0 place-content-center rounded-full bg-white text-brand-700 shadow-card">
                    <Lightbulb aria-hidden className="size-5" strokeWidth={1.75} />
                  </span>
                  <div className="min-w-0">
                    <p className="font-semibold text-ink">{block.title}</p>
                    <p className="mt-1 text-[15px] leading-relaxed text-ink-2">{block.text}</p>
                  </div>
                </div>
              </aside>
            );
          case "table":
            return (
              <div key={i} className="scrollbar-none -mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
                <table className="min-w-[34rem]">
                  <thead>
                    <tr>
                      {block.head.map((cell, j) => (
                        <th key={j} scope="col">
                          {cell}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {block.rows.map((row, r) => (
                      <tr key={r}>
                        {row.map((cell, c) => (
                          <td key={c}>{cell}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          default:
            return null;
        }
      })}
    </div>
  );
}
