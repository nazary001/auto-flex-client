"use client";

import type { ChangeEvent, ComponentProps } from "react";
import { cn } from "@/lib/cn";
import { formatPhone } from "@/lib/format";

const PREFIX = "+38 (0";

type PhoneInputProps = Omit<ComponentProps<"input">, "value" | "onChange" | "type"> & {
  /** Formatted value, e.g. "+38 (097) 123-45-67" */
  value: string;
  onChange: (value: string) => void;
};

/** Ukrainian mobile number with a live +38 (0XX) XXX-XX-XX mask. Validate with `isValidUaPhone`. */
export function PhoneInput({ value, onChange, className, onFocus, onBlur, ...props }: PhoneInputProps) {
  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const raw = event.target.value;
    let digits = raw.replace(/\D/g, "");
    // Backspace over a mask character: drop the digit before it instead
    if (raw.length < value.length && digits === value.replace(/\D/g, "")) digits = digits.slice(0, -1);
    onChange(formatPhone(digits));
  }

  return (
    <input
      type="tel"
      inputMode="tel"
      autoComplete="tel"
      placeholder="+38 (0__) ___-__-__"
      className={cn("field tabular", className)}
      value={value}
      onChange={handleChange}
      onFocus={(event) => {
        if (!value) onChange(PREFIX);
        onFocus?.(event);
      }}
      onBlur={(event) => {
        if (value === PREFIX) onChange("");
        onBlur?.(event);
      }}
      {...props}
    />
  );
}
