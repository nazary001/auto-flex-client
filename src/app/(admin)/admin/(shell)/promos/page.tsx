import type { Metadata } from "next";
import Link from "next/link";
import { ArrowDown, ArrowUp, Megaphone, Pencil, Plus, Trash2 } from "lucide-react";
import { ActionButton, Card, PageHeader, Pill } from "@/components/admin/ui";
import { buttonClass } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import type { PillTone } from "@/components/admin/ui";
import { can } from "@/lib/admin/permissions";
import { requireUser } from "@/lib/server/auth/dal";
import { getDb } from "@/lib/server/db/client";
import { listPromos } from "@/lib/server/db/repos/content";
import {
  deletePromoAction,
  reorderPromosAction,
  setPromoActiveAction,
} from "@/lib/admin/actions/content";

export const metadata: Metadata = { title: "Акції" };

const toneMeta: Record<string, { label: string; tone: PillTone }> = {
  navy: { label: "Темний", tone: "neutral" },
  blue: { label: "Синій", tone: "blue" },
  light: { label: "Світлий", tone: "amber" },
};

function swap<T>(items: T[], a: number, b: number): T[] {
  const next = [...items];
  [next[a], next[b]] = [next[b], next[a]];
  return next;
}

export default async function PromosPage() {
  const user = await requireUser("content:read");
  const db = await getDb();
  const promos = await listPromos(db, true);
  const canWrite = can(user, "content:write");
  const ids = promos.map((promo) => promo.id);

  return (
    <div>
      <PageHeader
        title="Акції"
        description="Банери на головній сторінці та у розділі «Акції»."
        actions={
          canWrite && (
            <Link href="/admin/promos/new" className={buttonClass({ size: "sm" })}>
              <Plus aria-hidden className="size-4" strokeWidth={1.75} />
              Акція
            </Link>
          )
        }
      />

      {promos.length === 0 ? (
        <EmptyState
          icon={<Megaphone />}
          title="Акцій ще немає"
          text="Створіть перший банер — він одразу зʼявиться на головній сторінці магазину."
          action={
            canWrite && (
              <Link href="/admin/promos/new" className={buttonClass()}>
                Створити акцію
              </Link>
            )
          }
        />
      ) : (
        <ul className="space-y-3">
          {promos.map((promo, index) => {
            const tone = toneMeta[promo.data.tone] ?? { label: promo.data.tone, tone: "neutral" as PillTone };
            return (
              <li key={promo.id}>
                <Card padded={false}>
                  <div className="flex flex-wrap items-start justify-between gap-4 p-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-[15px] font-semibold text-ink">{promo.data.title}</h3>
                        <Pill tone={tone.tone} size="sm" withDot={false}>
                          {tone.label}
                        </Pill>
                        <Pill tone={promo.active ? "green" : "slate"} size="sm">
                          {promo.active ? "Активна" : "Прихована"}
                        </Pill>
                      </div>
                      <p className="mt-1 line-clamp-2 text-sm text-ink-3">{promo.data.text}</p>
                      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-ink-3">
                        {promo.data.period && <span>{promo.data.period}</span>}
                        <Link href={promo.data.href} className="tabular text-brand-700 hover:underline">
                          {promo.data.href}
                        </Link>
                      </div>
                    </div>

                    {canWrite && (
                      <div className="flex shrink-0 items-center gap-1">
                        <ActionButton
                          action={reorderPromosAction.bind(null, { ids: swap(ids, index, index - 1) })}
                          variant="ghost"
                          size="sm"
                          disabled={index === 0}
                        >
                          <ArrowUp aria-hidden className="size-4" strokeWidth={1.75} />
                          <span className="sr-only">Вгору</span>
                        </ActionButton>
                        <ActionButton
                          action={reorderPromosAction.bind(null, { ids: swap(ids, index, index + 1) })}
                          variant="ghost"
                          size="sm"
                          disabled={index === promos.length - 1}
                        >
                          <ArrowDown aria-hidden className="size-4" strokeWidth={1.75} />
                          <span className="sr-only">Вниз</span>
                        </ActionButton>
                        <ActionButton
                          action={setPromoActiveAction.bind(null, { id: promo.id, active: !promo.active })}
                          variant="ghost"
                          size="sm"
                        >
                          {promo.active ? "Сховати" : "Показати"}
                        </ActionButton>
                        <Link
                          href={`/admin/promos/${promo.id}`}
                          className={buttonClass({ variant: "ghost", size: "sm" })}
                          aria-label="Редагувати"
                        >
                          <Pencil aria-hidden className="size-4" strokeWidth={1.75} />
                        </Link>
                        <ActionButton
                          action={deletePromoAction.bind(null, { id: promo.id })}
                          variant="ghost"
                          size="sm"
                          confirm={{
                            title: "Видалити акцію?",
                            text: `Банер «${promo.data.title}» буде видалено з сайту.`,
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
            );
          })}
        </ul>
      )}
    </div>
  );
}
