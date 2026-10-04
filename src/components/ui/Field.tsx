import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/cn";

interface FieldProps {
  label: ReactNode;
  /** id of the control inside */
  htmlFor: string;
  error?: string;
  hint?: ReactNode;
  required?: boolean;
  className?: string;
  children: ReactNode;
}

/** Label + control + hint/error. Give the control `aria-invalid` and `aria-describedby={`${id}-note`}`. */
export function Field({ label, htmlFor, error, hint, required, className, children }: FieldProps) {
  return (
    <div className={cn("grid content-start gap-1.5", className)}>
      <label htmlFor={htmlFor} className="text-sm font-medium text-ink-2">
        {label}
        {required && (
          <span aria-hidden className="text-danger">
            {" "}
            *
          </span>
        )}
      </label>
      {children}
      {error ? (
        <p id={`${htmlFor}-note`} role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : hint ? (
        <p id={`${htmlFor}-note`} className="text-sm text-ink-3">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export function Input({ className, ...props }: ComponentProps<"input">) {
  return <input className={cn("field", className)} {...props} />;
}

export function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  return <textarea className={cn("field", className)} {...props} />;
}

export function Select({ className, ...props }: ComponentProps<"select">) {
  return <select className={cn("field", className)} {...props} />;
}

type ChoiceProps = Omit<ComponentProps<"input">, "type"> & {
  label: ReactNode;
  /** Secondary line under the label */
  description?: ReactNode;
};

export function Checkbox({ label, description, className, ...props }: ChoiceProps) {
  return (
    <label className={cn("flex cursor-pointer items-start gap-2.5 text-[15px] leading-5", className)}>
      <input type="checkbox" className="check" {...props} />
      <span>
        <span className="text-ink">{label}</span>
        {description && <span className="mt-0.5 block text-sm text-ink-3">{description}</span>}
      </span>
    </label>
  );
}

export function Radio({ label, description, className, ...props }: ChoiceProps) {
  return (
    <label className={cn("flex cursor-pointer items-start gap-2.5 text-[15px] leading-5", className)}>
      <input type="radio" className="radio" {...props} />
      <span>
        <span className="text-ink">{label}</span>
        {description && <span className="mt-0.5 block text-sm text-ink-3">{description}</span>}
      </span>
    </label>
  );
}
