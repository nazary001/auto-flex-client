import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "light";
export type ButtonSize = "sm" | "md" | "lg";

interface ButtonStyle {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Full width */
  block?: boolean;
  className?: string;
}

/**
 * Class string for anything that should look like a button — use it on <Link>:
 * <Link href="/cart" className={buttonClass({ variant: "secondary" })}>…</Link>
 */
export function buttonClass({ variant = "primary", size = "md", block = false, className }: ButtonStyle = {}): string {
  return cn("btn", `btn-${variant}`, size !== "md" && `btn-${size}`, block && "btn-block", className);
}

type ButtonProps = ComponentProps<"button"> & ButtonStyle;

export function Button({ variant, size, block, className, type = "button", ...props }: ButtonProps) {
  return <button type={type} className={buttonClass({ variant, size, block, className })} {...props} />;
}
