"use client";

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { Card, SubmitButton } from "@/components/admin/ui";
import { Button } from "@/components/ui/Button";
import { Field, Input, Textarea } from "@/components/ui/Field";
import { toast } from "@/lib/store";
import type { ActionResult } from "@/lib/admin/actions/_action";
import type { MessageTemplate } from "@/lib/admin/types";
import { DEFAULT_TEMPLATES, TEMPLATE_PLACEHOLDERS } from "@/lib/admin/domain/templates";
import { saveTemplatesAction } from "@/lib/admin/actions/settings";

function newTemplate(): MessageTemplate {
  const id = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `tpl-${Date.now()}`;
  return { id, name: "", body: "" };
}

export function TemplatesForm({ templates: initial }: { templates: MessageTemplate[] }) {
  const router = useRouter();
  const [templates, setTemplates] = useState<MessageTemplate[]>(initial);

  const [, formAction] = useActionState<ActionResult | null, FormData>(async () => {
    const result = await saveTemplatesAction({ templates });
    if (result.ok) {
      toast({ title: "Шаблони збережено" });
      router.refresh();
    } else {
      toast({ title: result.error, tone: "error" });
    }
    return result;
  }, null);

  function update(id: string, patch: Partial<MessageTemplate>) {
    setTemplates((list) => list.map((template) => (template.id === id ? { ...template, ...patch } : template)));
  }

  return (
    <form action={formAction} className="space-y-4">
      <Card
        title="Доступні плейсхолдери"
        description="Підставляються у текст із даних замовлення під час відправлення повідомлення покупцю."
      >
        <ul className="flex flex-wrap gap-x-5 gap-y-1.5 text-[13px]">
          {TEMPLATE_PLACEHOLDERS.map((placeholder) => (
            <li key={placeholder.key} className="flex items-center gap-1.5">
              <code className="rounded bg-mist px-1.5 py-0.5 text-[12px] text-brand-700">{`{{${placeholder.key}}}`}</code>
              <span className="text-ink-3">{placeholder.description}</span>
            </li>
          ))}
        </ul>
      </Card>

      {templates.length === 0 && (
        <p className="rounded-card border border-dashed border-line px-4 py-6 text-center text-sm text-ink-3">
          Шаблонів немає. Додайте перший або скиньте до стандартних.
        </p>
      )}

      {templates.map((template, index) => (
        <Card key={template.id} padded={false}>
          <div className="space-y-3 p-4">
            <div className="flex items-start gap-3">
              <Field label="Назва шаблону" htmlFor={`tpl-name-${template.id}`} className="flex-1">
                <Input
                  id={`tpl-name-${template.id}`}
                  value={template.name}
                  onChange={(event) => update(template.id, { name: event.target.value })}
                  maxLength={80}
                  placeholder={`Шаблон ${index + 1}`}
                />
              </Field>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="mt-7"
                onClick={() => setTemplates((list) => list.filter((item) => item.id !== template.id))}
              >
                <Trash2 aria-hidden className="size-4" strokeWidth={1.75} />
                <span className="sr-only">Видалити шаблон</span>
              </Button>
            </div>
            <Field label="Текст" htmlFor={`tpl-body-${template.id}`}>
              <Textarea
                id={`tpl-body-${template.id}`}
                value={template.body}
                onChange={(event) => update(template.id, { body: event.target.value })}
                rows={4}
                maxLength={2000}
              />
            </Field>
          </div>
        </Card>
      ))}

      <div className="flex flex-wrap items-center gap-2">
        <SubmitButton pendingText="Зберігаємо…">Зберегти</SubmitButton>
        <Button type="button" variant="secondary" onClick={() => setTemplates((list) => [...list, newTemplate()])}>
          <Plus aria-hidden className="size-4" strokeWidth={1.75} />
          Шаблон
        </Button>
        <Button type="button" variant="ghost" onClick={() => setTemplates(DEFAULT_TEMPLATES.map((t) => ({ ...t })))}>
          Скинути до стандартних
        </Button>
      </div>
    </form>
  );
}
