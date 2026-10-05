import type { Metadata } from "next";
import { ArrowDown, ArrowUp, ChevronRight, HelpCircle, Trash2 } from "lucide-react";
import { ActionButton, Card, PageHeader, Pill } from "@/components/admin/ui";
import { EmptyState } from "@/components/ui/EmptyState";
import { FaqDialog } from "@/components/admin/content/FaqDialog";
import { can } from "@/lib/admin/permissions";
import { requireUser } from "@/lib/server/auth/dal";
import { getDb } from "@/lib/server/db/client";
import { listFaq } from "@/lib/server/db/repos/content";
import { deleteFaqAction, reorderFaqAction, setFaqActiveAction } from "@/lib/admin/actions/content";

export const metadata: Metadata = { title: "FAQ" };

function swap<T>(items: T[], a: number, b: number): T[] {
  const next = [...items];
  [next[a], next[b]] = [next[b], next[a]];
  return next;
}

export default async function FaqPage() {
  const user = await requireUser("content:read");
  const db = await getDb();
  const faq = await listFaq(db, true);
  const canWrite = can(user, "content:write");
  const ids = faq.map((item) => item.id);

  return (
    <div>
      <PageHeader
        title="Поширені запитання"
        description="Блок «Питання та відповіді» на сторінках магазину."
        actions={canWrite && <FaqDialog />}
      />

      {faq.length === 0 ? (
        <EmptyState
          icon={<HelpCircle />}
          title="Питань ще немає"
          text="Додайте перше питання — відповіді допомагають покупцям і зменшують кількість дзвінків."
          action={canWrite && <FaqDialog />}
        />
      ) : (
        <ul className="space-y-2.5">
          {faq.map((item, index) => (
            <li key={item.id}>
              <Card padded={false}>
                <div className="flex items-start justify-between gap-3 p-4">
                  <details className="group min-w-0 flex-1">
                    <summary className="flex cursor-pointer list-none items-center gap-2 [&::-webkit-details-marker]:hidden">
                      <ChevronRight
                        aria-hidden
                        className="size-4 shrink-0 text-ink-3 transition-transform group-open:rotate-90"
                        strokeWidth={2}
                      />
                      <span className="text-[15px] font-medium text-ink">{item.data.question}</span>
                      {!item.active && (
                        <Pill tone="slate" size="sm">
                          Прихована
                        </Pill>
                      )}
                    </summary>
                    <div className="mt-2 pl-6 text-sm whitespace-pre-line text-ink-2">{item.data.answer}</div>
                  </details>

                  {canWrite && (
                    <div className="flex shrink-0 items-center gap-1">
                      <ActionButton
                        action={reorderFaqAction.bind(null, { ids: swap(ids, index, index - 1) })}
                        variant="ghost"
                        size="sm"
                        disabled={index === 0}
                      >
                        <ArrowUp aria-hidden className="size-4" strokeWidth={1.75} />
                        <span className="sr-only">Вгору</span>
                      </ActionButton>
                      <ActionButton
                        action={reorderFaqAction.bind(null, { ids: swap(ids, index, index + 1) })}
                        variant="ghost"
                        size="sm"
                        disabled={index === faq.length - 1}
                      >
                        <ArrowDown aria-hidden className="size-4" strokeWidth={1.75} />
                        <span className="sr-only">Вниз</span>
                      </ActionButton>
                      <ActionButton
                        action={setFaqActiveAction.bind(null, { id: item.id, active: !item.active })}
                        variant="ghost"
                        size="sm"
                      >
                        {item.active ? "Сховати" : "Показати"}
                      </ActionButton>
                      <FaqDialog item={{ id: item.id, question: item.data.question, answer: item.data.answer }} />
                      <ActionButton
                        action={deleteFaqAction.bind(null, { id: item.id })}
                        variant="ghost"
                        size="sm"
                        confirm={{
                          title: "Видалити питання?",
                          text: `Питання «${item.data.question}» буде видалено.`,
                          confirmLabel: "Видалити",
                          tone: "danger",
                        }}
                      >
                        <Trash2 aria-hidden className="size-4" strokeWidth={1.75} />
                        <span className="sr-only">Видалити</span>
                      </ActionButton>
                    </div>
                  )}
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
