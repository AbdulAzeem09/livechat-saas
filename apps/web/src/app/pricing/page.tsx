"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, MessageSquareText } from "lucide-react";

interface Plan {
  name: string;
  blurb: string;
  monthly: number | null;
  features: string[];
  highlighted?: boolean;
  cta: string;
}

const PLANS: Plan[] = [
  {
    name: "Starter",
    blurb: "For individuals getting started with live chat.",
    monthly: 19,
    features: ["1 agent included", "Website chat widget", "60-day chat history", "Basic widget customization", "Ticketing system"],
    cta: "Start free trial"
  },
  {
    name: "Team",
    blurb: "For growing teams that need routing and reports.",
    monthly: 39,
    highlighted: true,
    features: ["Up to 5 agents", "Departments & routing", "Unlimited chat history", "Canned responses", "Reports & analytics", "Chatbot auto-replies"],
    cta: "Start free trial"
  },
  {
    name: "Business",
    blurb: "For companies that want automation and AI.",
    monthly: 59,
    features: ["Unlimited agents", "Working hours & availability", "Proactive campaigns & goals", "AI reply suggestions", "API keys & webhooks", "Advanced reports"],
    cta: "Start free trial"
  },
  {
    name: "Enterprise",
    blurb: "For large operations with custom needs.",
    monthly: null,
    features: ["Everything in Business", "Dedicated success manager", "SSO & security review", "Custom SLAs", "Onboarding & training"],
    cta: "Contact sales"
  }
];

export default function PricingPage() {
  const [annual, setAnnual] = useState(false);

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
          <Link className="rounded-lg px-4 py-2 hover:bg-slate-100" href="/login">
            Log in
          </Link>
          <Link
            className="rounded-lg bg-[#FF5100] px-4 py-2 text-white hover:bg-[#e64a00]"
            href="/register"
          >
            Sign up free
          </Link>
        </nav>
      </header>

      <section className="px-6 py-14 text-center md:px-12">
        <p className="text-sm font-bold uppercase tracking-wide text-[#FF5100]">Pricing</p>
        <h1 className="mx-auto mt-3 max-w-2xl text-4xl font-bold leading-tight md:text-5xl">
          Simple pricing that scales with your team
        </h1>
        <p className="mx-auto mt-4 max-w-lg text-base text-slate-500">
          Start with a free trial. No credit card required. Cancel anytime.
        </p>

        <div className="mt-8 inline-flex items-center gap-3 rounded-full border border-slate-200 p-1 text-sm font-semibold">
          <button
            className={annual ? "rounded-full px-4 py-1.5 text-slate-500" : "rounded-full bg-[#111214] px-4 py-1.5 text-white"}
            onClick={() => setAnnual(false)}
            type="button"
          >
            Monthly
          </button>
          <button
            className={annual ? "rounded-full bg-[#111214] px-4 py-1.5 text-white" : "rounded-full px-4 py-1.5 text-slate-500"}
            onClick={() => setAnnual(true)}
            type="button"
          >
            Annual <span className="text-emerald-400">-20%</span>
          </button>
        </div>
      </section>

      <section className="mx-auto grid max-w-6xl gap-6 px-6 pb-20 md:grid-cols-2 md:px-12 lg:grid-cols-4">
        {PLANS.map((plan) => {
          const price =
            plan.monthly === null ? null : annual ? Math.round(plan.monthly * 0.8) : plan.monthly;
          return (
            <div
              className={
                plan.highlighted
                  ? "relative flex flex-col rounded-2xl border-2 border-[#FF5100] p-6 shadow-lg"
                  : "flex flex-col rounded-2xl border border-slate-200 p-6"
              }
              key={plan.name}
            >
              {plan.highlighted && (
                <span className="absolute -top-3 left-6 rounded-full bg-[#FF5100] px-3 py-0.5 text-xs font-bold text-white">
                  Most popular
                </span>
              )}
              <h3 className="text-lg font-bold">{plan.name}</h3>
              <p className="mt-1 min-h-[40px] text-sm text-slate-500">{plan.blurb}</p>
              <div className="mt-4">
                {price === null ? (
                  <span className="text-3xl font-bold">Custom</span>
                ) : (
                  <>
                    <span className="text-4xl font-extrabold">${price}</span>
                    <span className="text-sm text-slate-500"> /mo per agent</span>
                  </>
                )}
              </div>
              <Link
                className={
                  plan.highlighted
                    ? "mt-5 rounded-lg bg-[#FF5100] py-2.5 text-center text-sm font-bold text-white hover:bg-[#e64a00]"
                    : "mt-5 rounded-lg border border-slate-300 py-2.5 text-center text-sm font-bold hover:bg-slate-50"
                }
                href={plan.monthly === null ? "/register" : "/register"}
              >
                {plan.cta}
              </Link>
              <ul className="mt-6 space-y-3 text-sm">
                {plan.features.map((feature) => (
                  <li className="flex gap-2 text-slate-600" key={feature}>
                    <Check className="h-4 w-4 shrink-0 text-emerald-500" aria-hidden />
                    {feature}
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </section>

      <footer className="border-t border-slate-100 px-6 py-8 text-center text-sm text-slate-400 md:px-12">
        © {2026} LiveChat clone — built with Next.js. <Link className="text-[#FF5100] hover:underline" href="/register">Get started free</Link>
      </footer>
    </main>
  );
}
