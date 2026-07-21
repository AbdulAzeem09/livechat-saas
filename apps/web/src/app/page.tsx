import Link from "next/link";
import { ArrowRight, Bot, Check, MessageSquareText, Sparkles, Users } from "lucide-react";

const HIGHLIGHTS = [
  { icon: MessageSquareText, title: "Live chat widget", copy: "Beautiful, fast widget that installs in one line." },
  { icon: Bot, title: "Chatbot & AI", copy: "Auto-reply, greetings, and AI-drafted answers 24/7." },
  { icon: Users, title: "Team & routing", copy: "Departments, roles, and never-miss-a-chat alerts." },
  { icon: Sparkles, title: "Campaigns & goals", copy: "Proactively invite visitors and measure conversions." }
];

export default function HomePage() {
  return (
    <main className="min-h-screen bg-white text-[#111214]">
      <header className="flex items-center justify-between border-b border-slate-100 px-6 py-4 md:px-12">
        <Link className="flex items-center gap-2" href="/">
          <span className="grid h-9 w-9 place-items-center rounded-lg bg-[#FF5100] text-white">
            <MessageSquareText className="h-5 w-5" aria-hidden />
          </span>
          <span className="text-lg font-bold">LiveChat</span>
        </Link>
        <nav className="flex items-center gap-2 text-sm font-semibold">
          <Link className="hidden rounded-lg px-4 py-2 hover:bg-slate-100 sm:block" href="/pricing">
            Pricing
          </Link>
          <Link className="rounded-lg px-4 py-2 hover:bg-slate-100" href="/login">
            Log in
          </Link>
          <Link className="rounded-lg bg-[#FF5100] px-4 py-2 text-white hover:bg-[#e64a00]" href="/register">
            Sign up free
          </Link>
        </nav>
      </header>

      <section className="mx-auto max-w-5xl px-6 py-20 text-center md:px-12">
        <span className="inline-flex items-center gap-2 rounded-full bg-[#fff0e8] px-3 py-1 text-xs font-bold text-[#FF5100]">
          <Sparkles className="h-3.5 w-3.5" aria-hidden /> Never miss a chat again
        </span>
        <h1 className="mx-auto mt-6 max-w-3xl text-5xl font-bold leading-[1.1] md:text-6xl">
          Chat with customers in <span className="text-[#FF5100]">real time</span>
        </h1>
        <p className="mx-auto mt-5 max-w-xl text-lg text-slate-500">
          Turn website visitors into customers with live chat, chatbots, and AI — all in one
          beautifully simple workspace.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link
            className="inline-flex items-center gap-2 rounded-lg bg-[#FF5100] px-6 py-3 text-sm font-bold text-white hover:bg-[#e64a00]"
            href="/register"
          >
            Start free trial <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
          <Link
            className="rounded-lg border border-slate-300 px-6 py-3 text-sm font-bold hover:bg-slate-50"
            href="/pricing"
          >
            See pricing
          </Link>
        </div>
        <p className="mt-4 flex flex-wrap items-center justify-center gap-4 text-xs text-slate-400">
          {["No credit card required", "5-minute setup", "Cancel anytime"].map((item) => (
            <span className="flex items-center gap-1.5" key={item}>
              <Check className="h-3.5 w-3.5 text-emerald-500" aria-hidden /> {item}
            </span>
          ))}
        </p>
      </section>

      <section className="mx-auto grid max-w-6xl gap-5 px-6 pb-24 md:grid-cols-2 md:px-12 lg:grid-cols-4">
        {HIGHLIGHTS.map((item) => (
          <div className="rounded-2xl border border-slate-200 p-6" key={item.title}>
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#fff0e8]">
              <item.icon className="h-5 w-5 text-[#FF5100]" aria-hidden />
            </span>
            <h3 className="mt-4 text-base font-bold">{item.title}</h3>
            <p className="mt-1 text-sm text-slate-500">{item.copy}</p>
          </div>
        ))}
      </section>

      <section className="bg-[#111214] px-6 py-16 text-center text-white md:px-12">
        <h2 className="mx-auto max-w-xl text-3xl font-bold">Ready to talk to your customers?</h2>
        <p className="mx-auto mt-3 max-w-md text-sm text-white/60">
          Join and launch your chat widget in minutes.
        </p>
        <Link
          className="mt-6 inline-flex items-center gap-2 rounded-lg bg-[#FF5100] px-6 py-3 text-sm font-bold text-white hover:bg-[#e64a00]"
          href="/register"
        >
          Get started free <ArrowRight className="h-4 w-4" aria-hidden />
        </Link>
      </section>

      <footer className="border-t border-slate-100 px-6 py-8 text-center text-sm text-slate-400 md:px-12">
        © 2026 LiveChat clone — built with Next.js &amp; NestJS.
      </footer>
    </main>
  );
}
