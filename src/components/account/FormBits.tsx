"use client";

import { useState, type ComponentProps, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { CircleAlert, CircleCheck, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Field";
import { cn } from "@/lib/cn";

/** Submit button that disables itself while the Server Action runs */
export function SubmitButton({
  children,
  pendingText,
  block = true,
  ...props
}: Omit<ComponentProps<typeof Button>, "type"> & { pendingText: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" block={block} disabled={pending} aria-busy={pending || undefined} {...props}>
      {pending ? pendingText : children}
    </Button>
  );
}

export function FormAlert({ tone, children }: { tone: "danger" | "success"; children: ReactNode }) {
  const Icon = tone === "danger" ? CircleAlert : CircleCheck;
  return (
    <div
      role={tone === "danger" ? "alert" : "status"}
      className={cn(
        "flex items-start gap-2 rounded-card border px-3.5 py-3 text-sm",
        tone === "danger" ? "border-danger/25 bg-danger-soft text-danger" : "border-ok/25 bg-ok-soft text-ok",
      )}
    >
      <Icon aria-hidden className="mt-0.5 size-4 shrink-0" strokeWidth={2} />
      <span>{children}</span>
    </div>
  );
}

/** Password field with a show/hide toggle */
export function PasswordInput({ className, ...props }: Omit<ComponentProps<"input">, "type">) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <Input type={visible ? "text" : "password"} className={cn("pr-11", className)} {...props} />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? "Сховати пароль" : "Показати пароль"}
        aria-pressed={visible}
        className="absolute inset-y-0 right-0 grid w-11 place-content-center text-ink-3 transition-colors hover:text-ink"
      >
        {visible ? <EyeOff aria-hidden className="size-5" strokeWidth={1.75} /> : <Eye aria-hidden className="size-5" strokeWidth={1.75} />}
      </button>
    </div>
  );
}
