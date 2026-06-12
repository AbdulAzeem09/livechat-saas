import { cn } from "@/lib/cn";

interface StatusPillProps {
  children: React.ReactNode;
  tone?: "green" | "amber" | "gray" | "red";
}

export function StatusPill({ children, tone = "gray" }: StatusPillProps) {
  return (
    <span
      className={cn(
        "inline-flex h-7 items-center rounded-full border px-2.5 text-xs font-semibold",
        tone === "green" && "border-brand-500/30 bg-brand-500/10 text-brand-700",
        tone === "amber" && "border-amber-500/30 bg-amber-500/10 text-amber-500",
        tone === "red" && "border-coral-500/30 bg-coral-500/10 text-coral-500",
        tone === "gray" && "border-line bg-white text-ink-600"
      )}
    >
      {children}
    </span>
  );
}
