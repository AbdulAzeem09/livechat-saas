import Link from "next/link";
import { Activity, MessageSquareText, ShieldCheck, UsersRound } from "lucide-react";

interface AuthShellProps {
  children: React.ReactNode;
  mode: "login" | "register";
}

export function AuthShell({ children, mode }: AuthShellProps) {
  return (
    <main className="grid min-h-screen bg-surface lg:grid-cols-[0.92fr_1.08fr]">
      <section className="flex min-h-[320px] flex-col justify-between border-b border-line bg-ink-950 p-6 text-white lg:border-b-0 lg:border-r lg:p-10">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-md bg-brand-500 text-white">
            <MessageSquareText className="h-5 w-5" aria-hidden />
          </div>
          <div>
            <p className="text-sm font-semibold">LiveChat SaaS</p>
            <p className="text-xs text-white/60">Support operations workspace</p>
          </div>
        </div>

        <div className="grid max-w-xl gap-7 py-10 lg:py-16">
          <div className="grid gap-3">
            <h1 className="max-w-[13ch] text-4xl font-semibold leading-tight tracking-normal sm:text-5xl">
              Customer conversations, organized.
            </h1>
            <p className="max-w-md text-sm leading-6 text-white/70">
              Agents, roles, routing, and inbox workflows in one focused dashboard.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            {[
              { icon: UsersRound, label: "Team", value: "Roles ready" },
              { icon: Activity, label: "Queue", value: "Live metrics" },
              { icon: ShieldCheck, label: "Access", value: "JWT guarded" }
            ].map((item) => (
              <div
                className="rounded-md border border-white/10 bg-white/[0.06] p-4"
                key={item.label}
              >
                <item.icon className="mb-3 h-4 w-4 text-brand-500" aria-hidden />
                <p className="text-xs uppercase text-white/50">{item.label}</p>
                <p className="mt-1 text-sm font-semibold">{item.value}</p>
              </div>
            ))}
          </div>
        </div>

        <p className="text-xs text-white/50">API: localhost:4000 - Web: localhost:3000</p>
      </section>

      <section className="flex items-center justify-center p-6 lg:p-10">
        <div className="w-full max-w-[440px] rounded-md border border-line bg-white p-6 shadow-panel sm:p-8">
          <div className="mb-7 flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase text-brand-700">
                {mode === "login" ? "Welcome back" : "Start workspace"}
              </p>
              <h2 className="mt-2 text-2xl font-semibold text-ink-950">
                {mode === "login" ? "Log in" : "Create account"}
              </h2>
            </div>
            <Link
              className="rounded-md px-3 py-2 text-sm font-semibold text-brand-700 hover:bg-brand-500/10"
              href={mode === "login" ? "/register" : "/login"}
            >
              {mode === "login" ? "Sign up" : "Log in"}
            </Link>
          </div>
          {children}
        </div>
      </section>
    </main>
  );
}
