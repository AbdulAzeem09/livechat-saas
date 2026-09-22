import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Check, Minus } from "lucide-react";
import {
  MarketingFooter,
  MarketingHeader,
  PageHero,
  Section,
  SectionHead
} from "@/components/marketing/marketing-chrome";
import { SiteChat } from "@/components/marketing/site-chat";
import { BRAND, pageTitle } from "@/lib/brand";

export const metadata: Metadata = {
  title: pageTitle("Pricing"),
  description: "Three plans, every feature on each one. Free for 14 days, no card needed."
};

/** These prices are the ones the billing system actually charges. */
const PLANS = [
  {
    code: "starter",
    name: "Starter",
    price: 19,
    unit: "per month",
    blurb: "One person answering, on one website.",
    highlights: [
      "1 agent",
      "Website chat widget",
      "AI agent and knowledge base",
      "All 16 reports",
      "Chatbot flow builder"
    ],
    cta: "Start free"
  },
  {
    code: "team",
    name: "Team",
    price: 59,
    unit: "per agent, per month",
    blurb: "A small team splitting the load, with email in the same inbox.",
    highlights: [
      "Unlimited agents",
      "Everything in Starter",
      "Email as a channel",
      "Departments and routing",
      "Work scheduler",
      "Scheduled report emails"
    ],
    featured: true,
    cta: "Start free"
  },
  {
    code: "business",
    name: "Business",
    price: 89,
    unit: "per agent, per month",
    blurb: "Every channel your customers use, and the controls IT will ask about.",
    highlights: [
      "Everything in Team",
      "WhatsApp, Messenger, Instagram",
      "Single sign-on",
      "Access restriction by network",
      "Audit log",
      "Priority support"
    ],
    cta: "Start free"
  }
] as const;

/** A comparison that includes what each plan does NOT have is more useful than one that doesn't. */
const COMPARISON: Array<{ feature: string; starter: string | boolean; team: string | boolean; business: string | boolean }> = [
  { feature: "Agents", starter: "1", team: "Unlimited", business: "Unlimited" },
  { feature: "Website chat widget", starter: true, team: true, business: true },
  { feature: "AI agent and skills", starter: true, team: true, business: true },
  { feature: "Knowledge base", starter: true, team: true, business: true },
  { feature: "Chatbot flow builder", starter: true, team: true, business: true },
  { feature: "All 16 reports", starter: true, team: true, business: true },
  { feature: "Revenue per chat", starter: true, team: true, business: true },
  { feature: "Email channel", starter: false, team: true, business: true },
  { feature: "Departments and routing", starter: false, team: true, business: true },
  { feature: "Work scheduler", starter: false, team: true, business: true },
  { feature: "Scheduled report emails", starter: false, team: true, business: true },
  { feature: "WhatsApp Business", starter: false, team: false, business: true },
  { feature: "Messenger and Instagram", starter: false, team: false, business: true },
  { feature: "Single sign-on", starter: false, team: false, business: true },
  { feature: "Access restriction", starter: false, team: false, business: true },
  { feature: "Audit log", starter: false, team: false, business: true },
  { feature: "REST API and webhooks", starter: true, team: true, business: true },
  { feature: "Customer SDK", starter: true, team: true, business: true }
];

const FAQ = [
  {
    q: `What happens after the ${BRAND.trialDays} days?`,
    a: "The dashboard keeps working so you can add a card, but the widget stops taking new chats. Nothing is deleted — your chats and settings are where you left them."
  },
  {
    q: "Do I pay for people who only read?",
    a: "No. Viewer and billing roles don't count towards your agent seats. You only pay for people who answer chats."
  },
  {
    q: "Is the AI agent extra?",
    a: "No. It's on every plan, including Starter. You bring your own model key, so what the assistant costs to run is between you and the model provider."
  },
  {
    q: "Can I change plan later?",
    a: "Yes, either direction, and the charge is adjusted for what's left of the month."
  },
  {
    q: "What if I need something that isn't there?",
    a: "Ask. We'll tell you whether it's coming, whether it isn't, and roughly when — rather than saying yes to close a sale."
  }
];

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-white text-[#0B1524]">
      <MarketingHeader />
      <SiteChat />

      <PageHero
        copy={`Free for ${BRAND.trialDays} days, no card needed. Billed per agent, monthly, cancel whenever you like.`}
        eyebrow="Pricing"
        title="Priced per person who answers"
      />

      {/* ------------------------------------------------------------ plans */}
      <Section>
        <div className="grid gap-5 lg:grid-cols-3">
          {PLANS.map((plan) => (
            <div
              className={`flex flex-col rounded-2xl border p-7 ${
                "featured" in plan && plan.featured
                  ? "border-[#0067FF] bg-white shadow-[0_24px_60px_-40px_rgba(0,103,255,0.55)]"
                  : "border-[#E3E9F2] bg-white"
              }`}
              key={plan.code}
            >
              <div className="flex items-center gap-2.5">
                <h2 className="text-[19px] font-bold">{plan.name}</h2>
                {"featured" in plan && plan.featured ? (
                  <span className="rounded-full bg-[#EEF3FF] px-2.5 py-0.5 text-[11px] font-bold text-[#0050C7]">
                    Most chosen
                  </span>
                ) : null}
              </div>
              <p className="mt-2 text-[14px] leading-relaxed text-[#5B6B82]">{plan.blurb}</p>

              <p className="mt-6 flex items-baseline gap-1.5">
                <span className="text-[40px] font-bold leading-none tracking-[-0.03em] [font-variant-numeric:tabular-nums]">
                  ${plan.price}
                </span>
              </p>
              <p className="mt-1.5 text-[13px] text-[#8494A8]">{plan.unit}</p>

              <Link
                className={`mt-6 rounded-lg px-5 py-2.5 text-center text-[15px] font-semibold transition-colors ${
                  "featured" in plan && plan.featured
                    ? "bg-[#0067FF] text-white hover:bg-[#0050C7]"
                    : "border border-[#CBD6E6] text-[#1D2B3E] hover:bg-[#F1F5FB]"
                }`}
                href="/register"
              >
                {plan.cta}
              </Link>

              <ul className="mt-7 grid gap-2.5 border-t border-[#E3E9F2] pt-6">
                {plan.highlights.map((item) => (
                  <li className="flex gap-2.5 text-[14px] leading-snug text-[#1D2B3E]" key={item}>
                    <Check aria-hidden className="mt-0.5 h-4 w-4 flex-none text-[#0E8A5F]" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </Section>

      {/* ------------------------------------------------------- comparison */}
      <Section tint>
        <SectionHead
          copy="Including the rows where a plan says no — you should know that before you buy, not after."
          title="Plan by plan"
        />
        {/* Phones get the same information stacked per plan — a 620px table on a 390px
            screen scrolls badly and pushes the whole page sideways. */}
        <div className="mt-8 grid gap-6 md:hidden">
          {PLANS.map((plan, planIndex) => (
            <div className="rounded-xl border border-[#E3E9F2] p-5" key={plan.code}>
              <h3 className="text-[16px] font-bold">{plan.name}</h3>
              <dl className="mt-3 grid gap-2">
                {COMPARISON.map((row) => {
                  const value = [row.starter, row.team, row.business][planIndex] ?? false;

                  return (
                    <div
                      className="flex items-center justify-between gap-4 border-b border-[#EEF2F7] pb-2 last:border-0"
                      key={row.feature}
                    >
                      <dt className="text-[14px] text-[#1D2B3E]">{row.feature}</dt>
                      <dd className="flex-none">
                        <PlanCell value={value} />
                      </dd>
                    </div>
                  );
                })}
              </dl>
            </div>
          ))}
        </div>

        <div className="mt-8 hidden overflow-x-auto md:block">
          <table className="w-full min-w-[620px] border-collapse text-[14px]">
            <thead>
              <tr>
                <th className="border-b border-[#CBD6E6] py-3 pr-4 text-left text-[12px] font-bold uppercase tracking-[0.07em] text-[#8494A8]">
                  Feature
                </th>
                {PLANS.map((plan) => (
                  <th
                    className="border-b border-[#CBD6E6] px-4 py-3 text-left text-[13px] font-bold text-[#0B1524]"
                    key={plan.code}
                  >
                    {plan.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {COMPARISON.map((row) => (
                <tr key={row.feature}>
                  <th className="border-b border-[#E3E9F2] py-3 pr-4 text-left font-medium text-[#1D2B3E]">
                    {row.feature}
                  </th>
                  {[row.starter, row.team, row.business].map((value, index) => (
                    <td className="border-b border-[#E3E9F2] px-4 py-3" key={index}>
                      <PlanCell value={value} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      {/* -------------------------------------------------------------- faq */}
      <Section>
        <SectionHead title="Questions people actually ask" />
        <dl className="mt-8 grid gap-7 md:grid-cols-2">
          {FAQ.map((item) => (
            <div key={item.q}>
              <dt className="text-[16px] font-bold">{item.q}</dt>
              <dd className="mt-1.5 text-[15px] leading-relaxed text-[#5B6B82]">{item.a}</dd>
            </div>
          ))}
        </dl>
        <div className="mt-10 rounded-2xl border border-[#E3E9F2] bg-[#F7F9FC] p-8">
          <h3 className="text-[19px] font-bold">Still deciding?</h3>
          <p className="mt-2 max-w-xl text-[15px] leading-relaxed text-[#5B6B82]">
            Start the trial — it needs no card, and nothing is charged unless you choose a plan
            at the end of it.
          </p>
          <Link
            className="mt-5 inline-flex items-center gap-2 rounded-lg bg-[#0067FF] px-5 py-2.5 text-[15px] font-semibold text-white transition-colors hover:bg-[#0050C7]"
            href="/register"
          >
            Start free <ArrowRight aria-hidden className="h-4 w-4" />
          </Link>
        </div>
      </Section>

      <MarketingFooter />
    </div>
  );
}

function PlanCell({ value }: { value: string | boolean }) {
  if (value === true) {
    return (
      <>
        <Check aria-hidden className="h-4 w-4 text-[#0E8A5F]" />
        <span className="sr-only">Included</span>
      </>
    );
  }

  if (value === false) {
    return (
      <>
        <Minus aria-hidden className="h-4 w-4 text-[#C3CEDD]" />
        <span className="sr-only">Not included</span>
      </>
    );
  }

  return <span className="font-medium text-[#1D2B3E]">{value}</span>;
}
