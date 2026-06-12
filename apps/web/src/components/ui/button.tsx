import type { ButtonHTMLAttributes, ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/cn";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon?: ReactNode;
  isLoading?: boolean;
  variant?: "primary" | "secondary" | "ghost" | "danger";
}

export function Button({
  children,
  className,
  disabled,
  icon,
  isLoading,
  type = "button",
  variant = "primary",
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex h-11 items-center justify-center gap-2 rounded-md px-4 text-sm font-semibold transition",
        "disabled:cursor-not-allowed disabled:opacity-60",
        variant === "primary" &&
          "bg-brand-700 text-white shadow-sm hover:bg-brand-600",
        variant === "secondary" &&
          "border border-line bg-white text-ink-800 hover:bg-surface",
        variant === "ghost" && "text-ink-600 hover:bg-white hover:text-ink-950",
        variant === "danger" && "bg-coral-500 text-white hover:bg-coral-500/90",
        className
      )}
      disabled={disabled || isLoading}
      type={type}
      {...props}
    >
      {isLoading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : icon}
      {children}
    </button>
  );
}
