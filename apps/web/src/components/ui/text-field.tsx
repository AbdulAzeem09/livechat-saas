import type { InputHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

interface TextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
}

export function TextField({ className, error, id, label, ...props }: TextFieldProps) {
  const inputId = id ?? props.name;

  return (
    <label className="grid gap-2 text-sm font-medium text-ink-800" htmlFor={inputId}>
      {label}
      <input
        id={inputId}
        className={cn(
          "h-11 rounded-md border border-line bg-white px-3 text-sm text-ink-950 shadow-sm transition",
          "placeholder:text-ink-500 hover:border-ink-500/40 focus:border-brand-600",
          error && "border-coral-500 focus:border-coral-500",
          className
        )}
        {...props}
      />
      {error ? <span className="text-xs font-medium text-coral-500">{error}</span> : null}
    </label>
  );
}
