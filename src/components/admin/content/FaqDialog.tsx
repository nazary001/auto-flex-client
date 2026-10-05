"use client";

import { useState, useTransition, type FormEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Field, Input, Textarea } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Modal";
import { toast } from "@/lib/store";
import { saveFaqAction } from "@/lib/admin/actions/content";

interface FaqDialogProps {
  /** Present → edit that item; absent → create a new one */
  item?: { id: string; question: string; answer: string };
  /** Overrides the default trigger button */
  trigger?: (open: () => void) => ReactNode;
}

/** Trigger button plus a modal form to create or edit one FAQ entry. */
export function FaqDialog({ item, trigger }: FaqDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [question, setQuestion] = useState(item?.question ?? "");
  const [answer, setAnswer] = useState(item?.answer ?? "");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  function openDialog() {
    setQuestion(item?.question ?? "");
    setAnswer(item?.answer ?? "");
    setFieldErrors({});
    setOpen(true);
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFieldErrors({});
    startTransition(async () => {
      const result = await saveFaqAction({ id: item?.id, question, answer });
      if (result.ok) {
        toast({ title: item ? "Питання оновлено" : "Питання додано" });
        setOpen(false);
        router.refresh();
      } else {
        if (result.fieldErrors) setFieldErrors(result.fieldErrors);
        toast({ title: result.error, tone: "error" });
      }
    });
  }

  return (
    <>
      {trigger ? (
        trigger(openDialog)
      ) : item ? (
        <Button variant="secondary" size="sm" onClick={openDialog}>
          Редагувати
        </Button>
      ) : (
        <Button size="sm" onClick={openDialog}>
          <Plus aria-hidden className="size-4" strokeWidth={1.75} />
          Питання
        </Button>
      )}
      <Modal open={open} onClose={() => setOpen(false)} title={item ? "Редагувати питання" : "Нове питання"}>
        <form onSubmit={onSubmit} className="grid gap-4">
          <Field label="Питання" htmlFor="faq-question" required error={fieldErrors.question}>
            <Input
              id="faq-question"
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              maxLength={200}
              required
            />
          </Field>
          <Field label="Відповідь" htmlFor="faq-answer" required error={fieldErrors.answer}>
            <Textarea
              id="faq-answer"
              value={answer}
              onChange={(event) => setAnswer(event.target.value)}
              rows={5}
              maxLength={2000}
              required
            />
          </Field>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
              Скасувати
            </Button>
            <Button type="submit" disabled={pending} aria-busy={pending || undefined}>
              {item ? "Зберегти" : "Додати"}
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
