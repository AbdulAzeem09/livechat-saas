import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";
import {
  MarketingCta,
  MarketingFooter,
  MarketingHeader,
  PageHero,
  Section,
  SectionHead
} from "@/components/marketing/marketing-chrome";
import { SiteChat } from "@/components/marketing/site-chat";
import { BRAND, pageTitle } from "@/lib/brand";

export const metadata: Metadata = {
  title: pageTitle("Solutions"),
  description: "How the same product is set up differently for shops, services, support and sales."
};

/**
 * Same product, four set-ups. Each one names the rule an owner in that trade would actually
 * write, because a generic "boost engagement" page persuades nobody.
 */
const SOLUTIONS = [
  {
    id: "shops",
    eyebrow: "Online shops",
    title: "Answer the question that decides the sale",
    copy:
      "Most abandoned baskets are a question nobody answered: will it arrive before Friday, does it come in blue, what happens if it does not fit.",
    setup: [
      "Connect Shopify so the customer's orders appear in the chat",
      "Teach the assistant your delivery times and return window",
      "Add a rule: refunds are never promised, the order number is taken",
      "Turn on the sales tracker to see what each chat was worth"
    ],
    rule: {
      name: "Where is my order",
      text:
        "Ask for the order number first. If they give one, hand the chat to a person with the number in the notes."
    }
  },
  {
    id: "services",
    eyebrow: "Clinics, salons, workshops",
    title: "Take the booking, even at midnight",
    copy:
      "Half the enquiries arrive after you have closed. An assistant that takes a name and a number turns those into callbacks instead of lost customers.",
    setup: [
      "Set your working hours so the widget shows when you are open",
      "Out of hours the assistant says so, and takes contact details",
      "Load your prices and services into the knowledge base",
      "Route by department so the right person picks it up in the morning"
    ],
    rule: {
      name: "Appointment requests",
      text:
        "Never confirm a time yourself. Take their name, number and what they need, and say someone will confirm."
    }
  },
  {
    id: "support",
    eyebrow: "Support teams",
    title: "Let the repeat questions answer themselves",
    copy:
      "The same twenty questions make up most of the queue. Handled automatically, your team gets back the hours it spends retyping them.",
    setup: [
      "Import your existing help articles, or pull them from your site",
      "Watch the AI performance report to see what it handles alone",
      "Use supervision to coach new agents on live chats",
      "Set chat limits so nobody is juggling nine conversations"
    ],
    rule: {
      name: "Complaints",
      text:
        "Apologise once, don't argue, don't explain policy. Take their phone number and hand the chat to a person immediately."
    }
  },
  {
    id: "sales",
    eyebrow: "Sales teams",
    title: "Reach the visitor while they are still reading",
    copy:
      "A message that arrives while someone is on the pricing page lands very differently from an email the next day.",
    setup: [
      "Set a campaign to greet visitors on high-intent pages",
      "See who is on the site right now and what they are reading",
      "Push qualified contacts to HubSpot when the chat is resolved",
      "Track revenue per chat and see which agent closes"
    ],
    rule: {
      name: "Price questions",
      text:
        "Give the price from the knowledge base. If they hesitate, mention the free trial and offer to book a call."
    }
  }
];

export default function SolutionsPage() {
  return (
    <div className="min-h-screen bg-white text-[#0B1524]">
      <MarketingHeader />
      <SiteChat />

      <PageHero
        copy={`${BRAND.name} is one product, not four. What changes is the rules you write and the channels you connect — here is how that looks in four trades.`}
        eyebrow="Solutions"
        title="Set up for the way you actually work"
      >
        <div className="flex flex-wrap gap-2.5">
          {SOLUTIONS.map((solution) => (
            <a
              className="rounded-lg border border-[#CBD6E6] px-3.5 py-2 text-[14px] font-medium text-[#1D2B3E] transition-colors hover:border-[#0067FF] hover:text-[#0067FF]"
              href={`#${solution.id}`}
              key={solution.id}
            >
              {solution.eyebrow}
            </a>
          ))}
        </div>
      </PageHero>

      {SOLUTIONS.map((solution, index) => (
        <Section key={solution.id} tint={index % 2 === 1}>
          <div className="grid scroll-mt-20 gap-10 lg:grid-cols-[1.1fr_1fr]" id={solution.id}>
            <div>
              <SectionHead copy={solution.copy} eyebrow={solution.eyebrow} title={solution.title} />
              <ul className="mt-7 grid gap-3">
                {solution.setup.map((step) => (
                  <li className="flex gap-3 text-[15px] leading-relaxed text-[#1D2B3E]" key={step}>
                    <Check aria-hidden className="mt-1 h-4 w-4 flex-none text-[#0E8A5F]" />
                    {step}
                  </li>
                ))}
              </ul>
            </div>

            <div className="self-start rounded-2xl border border-[#E3E9F2] bg-white p-6">
              <p className="text-[12px] font-bold uppercase tracking-[0.1em] text-[#8494A8]">
                A rule you might write
              </p>
              <p className="mt-4 text-[15px] font-bold">{solution.rule.name}</p>
              <p className="mt-2 text-[15px] leading-relaxed text-[#5B6B82]">
                “{solution.rule.text}”
              </p>
              <Link
                className="mt-5 inline-flex items-center gap-1.5 text-[14px] font-semibold text-[#0067FF] hover:underline"
                href="/features#ai"
              >
                How rules work <ArrowRight aria-hidden className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>
        </Section>
      ))}

      <MarketingCta />
      <MarketingFooter />
    </div>
  );
}
