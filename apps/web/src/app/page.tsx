import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  Bot,
  Check,
  Clock3,
  MessagesSquare,
  Plug,
  ShieldCheck,
  Tag,
  Users
} from "lucide-react";
import {
  MarketingCta,
  MarketingFooter,
  MarketingHeader,
  Section,
  SectionHead
} from "@/components/marketing/marketing-chrome";
import { SiteChat } from "@/components/marketing/site-chat";
import { BRAND } from "@/lib/brand";

export const metadata: Metadata = {
  title: `${BRAND.name} — ${BRAND.tagline}`,
  description: BRAND.summary
};

/** What the product actually does, in the order a buyer cares about it. */
const PILLARS = [
  {
    icon: MessagesSquare,
    title: "One inbox for every message",
    copy:
      "Website chat, WhatsApp, Messenger, Instagram and email all arrive in the same place, with the customer's history attached."
  },
  {
    icon: Bot,
    title: "An assistant that follows your rules",
    copy:
      "Write them the way you'd brief a new colleague — “never promise a refund, take the order number” — and it holds to them."
  },
  {
    icon: Users,
    title: "A team that never double-answers",
    copy:
      "Routing by department, working hours per agent, supervision, and a transfer that carries the whole conversation."
  },
  {
    icon: BarChart3,
    title: "Numbers you can act on",
    copy:
      "Sixteen reports, including what each chat was worth and how much the assistant handled on its own."
  }
];

const AI_POINTS = [
  "Answers from your own knowledge base, never from the open internet",
  "Steps aside the moment a customer asks for a person",
  "Takes a name and a number when your team is offline",
  "Tells you how many chats it finished without anyone"
];

/** Deliberately concrete: vague benefits persuade nobody who is about to pay. */
const PROOF = [
  { figure: "500", label: "visitors chatting at once, nothing dropped", note: "measured, single server" },
  { figure: "16", label: "reports, filtered by agent, tag or channel" },
  { figure: "5", label: "channels in one inbox" },
  { figure: `${BRAND.trialDays} days`, label: "free, no card needed" }
];

const STEPS = [
  {
    title: "Paste one line on your site",
    copy: "The widget appears straight away. Colours, logo and greeting are yours to set."
  },
  {
    title: "Tell the assistant your rules",
    copy: "Start from an example — refunds, prices, order tracking — and edit the wording."
  },
  {
    title: "Invite the people who answer",
    copy: "Set their hours so nobody gets a chat on their day off, and let routing do the rest."
  }
];

export default function HomePage() {
  return (
    <div className="min-h-screen bg-white text-[#0B1524]">
      <MarketingHeader />
      <SiteChat />

      {/* ------------------------------------------------------------- hero */}
      <section className="border-b border-[#E3E9F2] bg-white px-5 py-12 md:px-8 md:py-16">
        <div className="mx-auto grid max-w-6xl items-start gap-12 lg:grid-cols-[1.05fr_1fr]">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-[#D6E4FF] bg-[#EEF3FF] px-3 py-1 text-[12px] font-semibold text-[#0050C7]">
              <Bot aria-hidden className="h-3.5 w-3.5" />
              AI agent included on every plan
            </span>
            <h1 className="mt-5 text-balance text-[38px] font-bold leading-[1.08] tracking-[-0.025em] md:text-[54px]">
              Answer customers the moment they ask
            </h1>
            <p className="mt-5 max-w-xl text-[17px] leading-relaxed text-[#5B6B82]">
              {BRAND.name} puts live chat on your website and an assistant behind it — so the
              questions you've answered a hundred times get handled, and your team only sees the
              ones that need a person.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link
                className="inline-flex items-center gap-2 rounded-lg bg-[#0067FF] px-6 py-3 text-[15px] font-semibold text-white transition-colors hover:bg-[#0050C7]"
                href="/register"
              >
                Start free <ArrowRight aria-hidden className="h-4 w-4" />
              </Link>
              <Link
                className="rounded-lg border border-[#CBD6E6] px-6 py-3 text-[15px] font-semibold text-[#1D2B3E] transition-colors hover:bg-[#F1F5FB]"
                href="/features"
              >
                See what's inside
              </Link>
            </div>
            <p className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 text-[13px] text-[#8494A8]">
              {["No card needed", "5-minute setup", "Cancel any time"].map((item) => (
                <span className="flex items-center gap-1.5" key={item}>
                  <Check aria-hidden className="h-3.5 w-3.5 text-[#0E8A5F]" /> {item}
                </span>
              ))}
            </p>
          </div>

          {/* A sketch of the thing itself, rather than a stock photograph. */}
          <ChatPreview />
        </div>
      </section>

      {/* ------------------------------------------------------------ proof */}
      <section className="border-b border-[#E3E9F2] bg-[#F7F9FC] px-5 py-10 md:px-8">
        <dl className="mx-auto grid max-w-6xl gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {PROOF.map((item) => (
            <div key={item.label}>
              <dt className="text-[30px] font-bold leading-none tracking-[-0.02em] text-[#0B1524] [font-variant-numeric:tabular-nums]">
                {item.figure}
              </dt>
              <dd className="mt-2 text-[14px] leading-snug text-[#5B6B82]">
                {item.label}
                {item.note ? (
                  <span className="mt-0.5 block text-[12px] text-[#8494A8]">{item.note}</span>
                ) : null}
              </dd>
            </div>
          ))}
        </dl>
      </section>

      {/* --------------------------------------------------------- pillars */}
      <Section>
        <SectionHead
          eyebrow="What you get"
          title="Everything a support team needs, without the sprawl"
          copy="One product rather than four subscriptions stitched together — the chat, the assistant, the team tools and the reporting all know about each other."
        />
        <div className="mt-10 grid gap-x-10 gap-y-9 sm:grid-cols-2">
          {PILLARS.map((pillar) => (
            <div className="flex gap-4" key={pillar.title}>
              <span className="mt-0.5 grid h-10 w-10 flex-none place-items-center rounded-xl bg-[#EEF3FF]">
                <pillar.icon aria-hidden className="h-5 w-5 text-[#0067FF]" />
              </span>
              <div>
                <h3 className="text-[17px] font-bold">{pillar.title}</h3>
                <p className="mt-1.5 text-[15px] leading-relaxed text-[#5B6B82]">{pillar.copy}</p>
              </div>
            </div>
          ))}
        </div>
      </Section>

      {/* -------------------------------------------------------------- AI */}
      <Section tint>
        <div className="grid items-start gap-12 lg:grid-cols-2">
          <div>
            <SectionHead
              eyebrow="AI agent"
              title="It works from what you know, not what it guesses"
              copy="Most chat assistants either make things up or answer nothing. This one reads your knowledge base and follows rules you wrote, and hands over the moment it should."
            />
            <ul className="mt-7 grid gap-3">
              {AI_POINTS.map((point) => (
                <li className="flex gap-3 text-[15px] leading-relaxed text-[#1D2B3E]" key={point}>
                  <Check aria-hidden className="mt-1 h-4 w-4 flex-none text-[#0E8A5F]" />
                  {point}
                </li>
              ))}
            </ul>
            <Link
              className="mt-7 inline-flex items-center gap-2 text-[15px] font-semibold text-[#0067FF] hover:underline"
              href="/features#ai"
            >
              How the assistant works <ArrowRight aria-hidden className="h-4 w-4" />
            </Link>
          </div>

          <SkillCard />
        </div>
      </Section>

      {/* ----------------------------------------------------------- inbox */}
      <Section>
        <div className="grid items-start gap-12 lg:grid-cols-[1fr_1.1fr]">
          <div>
            <SectionHead
              copy="A WhatsApp message and a website chat are the same job. They arrive in one queue, with who the customer is and what they bought already attached."
              eyebrow="One inbox"
              title="Stop checking five places"
            />
            <ul className="mt-7 grid gap-3">
              {[
                "Every channel in one list, not five tabs",
                "The customer's past chats and orders beside the message",
                "Internal notes your customer never sees",
                "Transfer a chat and the whole history goes with it"
              ].map((point) => (
                <li className="flex gap-3 text-[15px] leading-relaxed text-[#1D2B3E]" key={point}>
                  <Check aria-hidden className="mt-1 h-4 w-4 flex-none text-[#0E8A5F]" />
                  {point}
                </li>
              ))}
            </ul>
          </div>
          <InboxPreview />
        </div>
      </Section>

      {/* ---------------------------------------------------- integrations */}
      <Section tint>
        <SectionHead
          copy="The chat already knows who the customer is. These make it know what they bought, and tell the rest of your team when something happens."
          eyebrow="Integrations"
          title="It fits what you already run"
        />
        <div className="mt-9 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { name: "Shopify", copy: "Their recent orders, in the chat" },
            { name: "WhatsApp Business", copy: "Messages in the same inbox" },
            { name: "Slack", copy: "New chats ping your channel" },
            { name: "HubSpot", copy: "Contacts pushed on resolve" },
            { name: "Messenger", copy: "Facebook pages, connected" },
            { name: "Instagram", copy: "DMs in the same queue" },
            { name: "Email", copy: "support@ becomes a chat" },
            { name: "Webhooks & API", copy: "Everything else" }
          ].map((item) => (
            <div className="rounded-xl border border-[#E3E9F2] bg-white p-4" key={item.name}>
              <p className="text-[15px] font-semibold">{item.name}</p>
              <p className="mt-1 text-[13.5px] leading-snug text-[#5B6B82]">{item.copy}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* --------------------------------------------------------- reports */}
      <Section>
        <SectionHead
          copy="Built on what actually happened — never demo figures. Filter any of them by date, agent, tag or channel."
          eyebrow="Reports"
          title="Know what the chat is worth"
        />
        <div className="mt-9 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { label: "Revenue from chats", value: "$4,280", note: "this month, per agent too" },
            { label: "Finished by the assistant", value: "63%", note: "without a person" },
            { label: "Missed chats", value: "4", note: "the number that matters" },
            { label: "Average first reply", value: "38s", note: "across the team" }
          ].map((card) => (
            <div className="rounded-xl border border-[#E3E9F2] p-5" key={card.label}>
              <p className="text-[12px] font-semibold uppercase tracking-[0.06em] text-[#8494A8]">
                {card.label}
              </p>
              <p className="mt-2 text-[26px] font-bold leading-none tracking-[-0.02em] [font-variant-numeric:tabular-nums]">
                {card.value}
              </p>
              <p className="mt-1.5 text-[13px] text-[#5B6B82]">{card.note}</p>
            </div>
          ))}
        </div>
        <p className="mt-5 text-[13px] text-[#8494A8]">
          Example figures, to show the shape of the reports — your own workspace starts at zero.
        </p>
      </Section>

      {/* ----------------------------------------------------------- steps */}
      <Section>
        <SectionHead title="Live in an afternoon" copy="No developer, no migration, no training week." />
        <ol className="mt-10 grid gap-8 md:grid-cols-3">
          {STEPS.map((step, index) => (
            <li key={step.title}>
              <span className="text-[13px] font-bold text-[#0067FF] [font-variant-numeric:tabular-nums]">
                Step {index + 1}
              </span>
              <h3 className="mt-2 text-[17px] font-bold">{step.title}</h3>
              <p className="mt-1.5 text-[15px] leading-relaxed text-[#5B6B82]">{step.copy}</p>
            </li>
          ))}
        </ol>
      </Section>

      {/* -------------------------------------------------------- trust row */}
      <Section tint>
        <div className="grid gap-10 md:grid-cols-3">
          {[
            {
              icon: ShieldCheck,
              title: "Built to be handed to IT",
              copy:
                "Two-factor sign-in, single sign-on, an audit log, encrypted keys, and card numbers masked before they are ever stored.",
              href: "/security",
              link: "Read about security"
            },
            {
              icon: Plug,
              title: "Connects to what you use",
              copy:
                "Shopify orders in the chat, Slack alerts, HubSpot contacts, webhooks and a REST API for everything else.",
              href: "/features#integrations",
              link: "See integrations"
            },
            {
              icon: Clock3,
              title: "Priced so it adds up",
              copy:
                "Per agent, billed monthly or yearly, with every feature on every plan. No “call us” tier to unlock the basics.",
              href: "/pricing",
              link: "See pricing"
            }
          ].map((item) => (
            <div key={item.title}>
              <item.icon aria-hidden className="h-6 w-6 text-[#0067FF]" />
              <h3 className="mt-3.5 text-[17px] font-bold">{item.title}</h3>
              <p className="mt-1.5 text-[15px] leading-relaxed text-[#5B6B82]">{item.copy}</p>
              <Link
                className="mt-3 inline-flex items-center gap-1.5 text-[14px] font-semibold text-[#0067FF] hover:underline"
                href={item.href}
              >
                {item.link} <ArrowRight aria-hidden className="h-3.5 w-3.5" />
              </Link>
            </div>
          ))}
        </div>
      </Section>

      <MarketingCta />
      <MarketingFooter />
    </div>
  );
}

/* ------------------------------------------------------------------ visuals */

/** A still of a real conversation — the assistant answering, then handing over. */
function ChatPreview() {
  return (
    <div className="rounded-2xl border border-[#E3E9F2] bg-[#F7F9FC] p-3 shadow-[0_20px_50px_-30px_rgba(11,21,36,0.4)]">
      <div className="overflow-hidden rounded-xl border border-[#E3E9F2] bg-white">
        <div className="flex items-center gap-2.5 border-b border-[#E3E9F2] bg-[#0B1524] px-4 py-3">
          <span className="grid h-7 w-7 place-items-center rounded-full bg-[#0067FF] text-[11px] font-bold text-white">
            S
          </span>
          <span className="text-[13px] font-semibold text-white">Sara · Support</span>
          <span className="ml-auto flex items-center gap-1.5 text-[11px] text-white/50">
            <span className="h-1.5 w-1.5 rounded-full bg-[#4ADE80]" aria-hidden />
            Online
          </span>
        </div>

        {/* flex, not grid: in a grid, self-end aligns on the wrong axis and every bubble
            stretches to the full width instead of sitting on its own side. */}
        <div className="flex flex-col gap-2.5 px-4 py-5">
          <Bubble side="visitor">Do you ship to Karachi, and how long does it take?</Bubble>
          <Tagline>Assistant · answered from your knowledge base</Tagline>
          <Bubble side="agent">
            Yes — Karachi usually takes 2–3 working days. Orders placed before 4pm go out the same
            day.
          </Bubble>
          <Bubble side="visitor">I'd like a refund on order 4417 actually</Bubble>
          <Tagline>Rule matched: “Refund requests” · handed to a person</Tagline>
          <Bubble side="agent">
            I've passed this to Sara with your order number — she'll reply here shortly.
          </Bubble>
        </div>

        <div className="flex items-center gap-2 border-t border-[#E3E9F2] px-4 py-3">
          <span className="flex-1 rounded-lg bg-[#F1F5FB] px-3 py-2 text-[13px] text-[#8494A8]">
            Write a message…
          </span>
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-[#0067FF]" aria-hidden>
            <ArrowRight className="h-4 w-4 text-white" />
          </span>
        </div>
      </div>
    </div>
  );
}

/** The agent's queue: several channels, one list. */
function InboxPreview() {
  const chats = [
    { who: "Ayesha Khan", via: "WhatsApp", last: "Kya yeh stock mein hai?", time: "now", unread: true },
    { who: "Tom Baker", via: "Website", last: "Do you ship to Karachi?", time: "2m", unread: true },
    { who: "sara@acme.com", via: "Email", last: "Refund for order 4417", time: "14m", unread: false },
    { who: "Visitor 8812", via: "Website", last: "Assistant answered · resolved", time: "1h", unread: false },
    { who: "@luca.dm", via: "Instagram", last: "is the blue one back?", time: "3h", unread: false }
  ];

  return (
    <div className="overflow-hidden rounded-2xl border border-[#E3E9F2] bg-white shadow-[0_20px_50px_-32px_rgba(11,21,36,0.45)]">
      <div className="flex items-center justify-between border-b border-[#E3E9F2] px-4 py-3">
        <p className="text-[13px] font-bold">All chats</p>
        <span className="rounded-full bg-[#EEF3FF] px-2.5 py-0.5 text-[11px] font-bold text-[#0050C7]">
          2 waiting
        </span>
      </div>
      <ul>
        {chats.map((chat) => (
          <li
            className="flex items-start gap-3 border-b border-[#F1F5FB] px-4 py-3 last:border-0"
            key={chat.who}
          >
            <span
              aria-hidden
              className={`mt-1.5 h-2 w-2 flex-none rounded-full ${
                chat.unread ? "bg-[#0067FF]" : "bg-[#D4DDE9]"
              }`}
            />
            <span className="min-w-0 flex-1">
              <span className="flex items-baseline justify-between gap-3">
                <span className="truncate text-[13.5px] font-semibold">{chat.who}</span>
                <span className="flex-none text-[11px] text-[#8494A8]">{chat.time}</span>
              </span>
              <span className="mt-0.5 block truncate text-[13px] text-[#5B6B82]">{chat.last}</span>
              <span className="mt-1.5 inline-block rounded border border-[#E3E9F2] px-1.5 py-0.5 text-[10.5px] font-medium text-[#5B6B82]">
                {chat.via}
              </span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Bubble({ children, side }: { children: string; side: "visitor" | "agent" }) {
  const visitor = side === "visitor";

  return (
    <p
      className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-[13.5px] leading-relaxed ${
        visitor
          ? "self-end rounded-br-md bg-[#0067FF] text-white"
          : "self-start rounded-bl-md bg-[#F1F5FB] text-[#1D2B3E]"
      }`}
    >
      {children}
    </p>
  );
}

function Tagline({ children }: { children: string }) {
  return (
    <span className="self-start text-[11px] font-medium uppercase tracking-[0.06em] text-[#8494A8]">
      {children}
    </span>
  );
}

/** The skills screen, shown as the thing an owner actually writes. */
function SkillCard() {
  return (
    <div className="rounded-2xl border border-[#E3E9F2] bg-white p-5 shadow-[0_20px_50px_-32px_rgba(11,21,36,0.45)]">
      <p className="text-[12px] font-bold uppercase tracking-[0.1em] text-[#8494A8]">
        Automate → AI skills
      </p>
      <div className="mt-4 grid gap-3">
        {[
          {
            name: "Refund requests",
            rule: "Never promise a refund. Take the order number and hand the chat to a person.",
            when: "refund, money back, return"
          },
          {
            name: "Price questions",
            rule: "Give the price from the knowledge base. Mention the free trial if they hesitate.",
            when: "price, cost, how much"
          },
          {
            name: "House style",
            rule: "Keep every answer under three sentences.",
            when: null
          }
        ].map((skill) => (
          <div className="rounded-xl border border-[#E3E9F2] p-4" key={skill.name}>
            <div className="flex items-center justify-between gap-3">
              <p className="text-[14px] font-bold">{skill.name}</p>
              <span className="flex items-center gap-1.5 text-[11px] font-semibold text-[#0E8A5F]">
                <span className="h-1.5 w-1.5 rounded-full bg-[#0E8A5F]" aria-hidden /> On
              </span>
            </div>
            <p className="mt-1.5 text-[13.5px] leading-relaxed text-[#5B6B82]">{skill.rule}</p>
            <p className="mt-2 flex items-center gap-1.5 text-[11.5px] text-[#8494A8]">
              <Tag aria-hidden className="h-3 w-3" />
              {skill.when ? `Used when they mention: ${skill.when}` : "Used on every message"}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
