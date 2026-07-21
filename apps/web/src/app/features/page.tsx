import Link from "next/link";
import {
  BarChart3,
  Bot,
  Building2,
  MessageSquareText,
  Puzzle,
  Sparkles,
  Ticket,
  Users,
  Zap
} from "lucide-react";
import { MarketingCta, MarketingFooter, MarketingHeader } from "@/components/marketing/marketing-chrome";

const GROUPS = [
  {
    title: "Live chat & inbox",
    icon: MessageSquareText,
    items: [
      "Real-time website chat widget (2-view, fully customizable)",
      "Pre-chat & post-chat forms, file sharing, chat ratings",
      "Canned responses, tags, chat transfer, message sneak-peek",
      "Archives with full-text search"
    ]
  },
  {
    title: "Automation & AI",
    icon: Bot,
    items: [
      "Chatbot with greetings & keyword rules",
      "Knowledge base that trains your bot's answers",
      "AI reply suggestions (Copilot)",
      "Auto-routing to the least-busy agent"
    ]
  },
  {
    title: "Engage visitors",
    icon: Sparkles,
    items: [
      "Real-time visitor tracking with geo-location",
      "Eye-catcher teasers & proactive campaigns",
      "Goals & conversion tracking",
      "Working hours / away mode"
    ]
  },
  {
    title: "Reports & analytics",
    icon: BarChart3,
    items: [
      "Real-time overview + 9 report types",
      "Chat satisfaction (CSAT), engagement, missed chats",
      "Agent performance & availability",
      "CSV / data export (GDPR)"
    ]
  },
  {
    title: "Team & tickets",
    icon: Users,
    items: [
      "Agents, roles (Owner/Admin/Agent), departments",
      "Invite system & chat limits per agent",
      "Ticketing system (HelpDesk)",
      "Internal private notes"
    ]
  },
  {
    title: "Integrations & platform",
    icon: Puzzle,
    items: [
      "WordPress & Shopify plugins",
      "Google Tag Manager, Slack notifications",
      "REST API + webhooks",
      "Security: domain restrictions, data controls"
    ]
  }
];

export default function FeaturesPage() {
  return (
    <main className="min-h-screen bg-white text-[#111214]">
      <MarketingHeader />

      <section className="mx-auto max-w-4xl px-6 py-16 text-center">
        <p className="text-sm font-bold uppercase tracking-wide text-[#FF5100]">Features</p>
        <h1 className="mx-auto mt-3 max-w-2xl text-4xl font-bold md:text-5xl">
          Everything you need to talk to customers
        </h1>
        <p className="mx-auto mt-4 max-w-lg text-slate-500">
          One workspace for live chat, chatbots, AI, campaigns, reports, and your whole team.
        </p>
      </section>

      <section className="mx-auto grid max-w-6xl gap-6 px-6 pb-20 md:grid-cols-2 lg:grid-cols-3">
        {GROUPS.map((group) => (
          <div className="rounded-2xl border border-slate-200 p-6" key={group.title}>
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#fff0e8]">
              <group.icon className="h-5 w-5 text-[#FF5100]" aria-hidden />
            </span>
            <h3 className="mt-4 text-lg font-bold">{group.title}</h3>
            <ul className="mt-3 space-y-2 text-sm text-slate-600">
              {group.items.map((item) => (
                <li className="flex gap-2" key={item}>
                  <Zap className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#FF5100]" aria-hidden />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </section>

      <section className="mx-auto max-w-4xl px-6 pb-16 text-center">
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Building2 className="h-5 w-5 text-slate-400" aria-hidden />
          <span className="text-sm text-slate-500">Multi-tenant · each account gets its own widget & workspace</span>
          <Ticket className="h-5 w-5 text-slate-400" aria-hidden />
        </div>
        <Link
          className="mt-6 inline-block rounded-lg bg-[#FF5100] px-6 py-3 text-sm font-bold text-white hover:bg-[#e64a00]"
          href="/register"
        >
          Try all features free
        </Link>
      </section>

      <MarketingCta />
      <MarketingFooter />
    </main>
  );
}
