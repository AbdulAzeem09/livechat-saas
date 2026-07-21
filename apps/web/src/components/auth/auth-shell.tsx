import Link from "next/link";
import { Bot, Check, MessageSquareText, Sparkles, UsersRound } from "lucide-react";

interface AuthShellProps {
  children: React.ReactNode;
  mode: "login" | "register";
}

export function AuthShell({ children, mode }: AuthShellProps) {
  return (
    <main className="grid min-h-screen bg-white lg:grid-cols-[1.05fr_0.95fr]">
      <section className="relative flex min-h-[320px] flex-col justify-between overflow-hidden bg-[#111214] p-6 text-white lg:p-12">
        <Link className="flex items-center gap-2" href="/">
          <span className="grid h-9 w-9 place-items-center rounded-lg bg-[#FF5100] text-white">
            <MessageSquareText className="h-5 w-5" aria-hidden />
          </span>
          <span className="text-lg font-bold">LiveChat</span>
        </Link>

        <div className="grid max-w-xl gap-8 py-10">
          <div className="grid gap-3">
            <h1 className="max-w-[15ch] text-4xl font-bold leading-tight sm:text-5xl">
              Chat with customers in <span className="text-[#FF5100]">real time</span>.
            </h1>
            <p className="max-w-md text-sm leading-6 text-white/70">
              Live chat, chatbots, campaigns, and AI — one focused workspace that never misses a chat.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            {[
              { icon: UsersRound, label: "Team", value: "Routing ready" },
              { icon: Bot, label: "Automation", value: "Chatbot + AI" },
              { icon: Sparkles, label: "Engage", value: "Campaigns" }
            ].map((item) => (
              <div className="rounded-xl border border-white/10 bg-white/[0.06] p-4" key={item.label}>
                <item.icon className="mb-3 h-4 w-4 text-[#FF5100]" aria-hidden />
                <p className="text-xs uppercase text-white/50">{item.label}</p>
                <p className="mt-1 text-sm font-semibold">{item.value}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-4 text-xs text-white/50">
          {["No credit card", "5-minute setup", "Cancel anytime"].map((item) => (
            <span className="flex items-center gap-1.5" key={item}>
              <Check className="h-3.5 w-3.5 text-emerald-400" aria-hidden /> {item}
            </span>
          ))}
        </div>
      </section>

      <section className="flex items-center justify-center p-6 lg:p-10">
        <div className="w-full max-w-[440px]">
          <div className="mb-7 flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-[#FF5100]">
                {mode === "login" ? "Welcome back" : "Start free"}
              </p>
              <h2 className="mt-2 text-2xl font-bold text-[#111214]">
                {mode === "login" ? "Sign in to LiveChat" : "Create your account"}
              </h2>
            </div>
            <Link
              className="rounded-lg px-3 py-2 text-sm font-bold text-[#FF5100] hover:bg-[#fff0e8]"
              href={mode === "login" ? "/register" : "/login"}
            >
              {mode === "login" ? "Sign up" : "Log in"}
            </Link>
          </div>
          {children}
          <p className="mt-6 text-center text-xs text-slate-400">
            <Link className="hover:text-[#FF5100]" href="/pricing">
              See pricing
            </Link>
            {" · "}
            <Link className="hover:text-[#FF5100]" href="/">
              Back to home
            </Link>
          </p>
        </div>
      </section>
    </main>
  );
}
