"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Field";
import { Card, CopyText } from "@/components/admin/ui";
import { renderOrderTemplate } from "@/lib/admin/domain/templates";
import type { MessageTemplate, Order } from "@/lib/admin/types";
import { logMessageAction } from "@/lib/admin/actions/orders";
import { useOrderAction } from "./use-order-action";

interface OrderMessagesProps {
  order: Order;
  templates: MessageTemplate[];
  canWrite: boolean;
}

/** Message templates rendered for this order; the manager copies the text and logs that it was sent. */
export function OrderMessages({ order, templates, canWrite }: OrderMessagesProps) {
  const { pending, run } = useOrderAction();
  const [templateId, setTemplateId] = useState(templates[0]?.id ?? "");
  const template = templates.find((t) => t.id === templateId) ?? templates[0];
  const rendered = useMemo(() => (template ? renderOrderTemplate(template, order) : ""), [template, order]);
  const [text, setText] = useState(rendered);
  const [touched, setTouched] = useState(false);
  const value = touched ? text : rendered;

  if (templates.length === 0) {
    return (
      <Card title="Повідомлення">
        <p className="text-sm text-ink-3">Додайте шаблони повідомлень у налаштуваннях.</p>
      </Card>
    );
  }

  return (
    <Card title="Повідомлення">
      <select
        value={templateId}
        aria-label="Шаблон повідомлення"
        className="field field-sm w-full"
        onChange={(e) => {
          setTemplateId(e.target.value);
          setTouched(false);
        }}
      >
        {templates.map((t) => (
          <option key={t.id} value={t.id}>
            {t.name}
          </option>
        ))}
      </select>
      <Textarea
        className="mt-3 text-[13px]"
        rows={6}
        value={value}
        onChange={(e) => {
          setText(e.target.value);
          setTouched(true);
        }}
        aria-label="Текст повідомлення"
      />
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <CopyText text={value} label="Скопіювати" className="text-sm font-medium" />
        {canWrite && (
          <Button
            variant="secondary"
            size="sm"
            disabled={pending}
            onClick={() => run(() => logMessageAction({ id: order.id, templateId }), { success: "Позначено надісланим" })}
          >
            Відмітити надісланим
          </Button>
        )}
      </div>
    </Card>
  );
}
