"use client";

import { useFormStatus } from "react-dom";
import type { ReactNode } from "react";
import { Button, type ButtonSize, type ButtonVariant } from "@/components/ui/Button";

interface SubmitButtonProps {
  children: ReactNode;
  /** Label while the form is submitting */
  pendingText?: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  block?: boolean;
  className?: string;
  disabled?: boolean;
}

/** Submit control wired to the enclosing <form>'s pending state via useFormStatus. */
export function SubmitButton({ children, pendingText, disabled, ...style }: SubmitButtonProps) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending || disabled} aria-busy={pending || undefined} {...style}>
      {pending && pendingText ? pendingText : children}
    </Button>
  );
}
