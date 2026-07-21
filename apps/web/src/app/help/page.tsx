import Link from "next/link";
import {
  Bot,
  CreditCard,
  MessageSquareText,
  Rocket,
  Search,
  Settings,
  Users
} from "lucide-react";
import { MarketingCta, MarketingFooter, MarketingHeader } from "@/components/marketing/marketing-chrome";

const CATEGORIES = [
  { icon: Rocket, title: "Getting started", desc: "Create your account, add the widget, invite your team." },
  { icon: MessageSquareText, title: "Using the chat", desc: "Answer chats, tags, transfers, canned responses." },
  { icon: Bot, title: "Chatbot & AI", desc: "Greetings, keyword rules, and knowledge base training." },
  { icon: Users, title: "Team & roles", desc: "Agents, permissions, departments, and chat limits." },
  { icon: Settings, title: "Settings & install", desc: "Customize the widget, GTM, security, working hours." },
  { icon: CreditCard, title: "Billing", desc: "Plans, invoices, and managing your subscription." }
];

const FAQ = [
  {
    q: "How do I add the chat widget to my website?",
    a: "Go to Settings → Install, copy your widget snippet, and paste it before the closing </body> tag. WordPress and Shopify users can use our plugins for a one-click install."
  },
  {
    q: "How does the chatbot answer questions?",
    a: "The chatbot fires greeting and keyword rules first. If no rule matches, it searches your published Knowledge Base articles and replies with the best match — so keeping your knowledge base updated trains the bot."
  },
  {
    q: "Can I control who sees the chat and when?",
    a: "Yes. Set working hours to show an away message outside business hours, restrict the widget to trusted domains, and route chats to specific departments or the least-busy agent."
  },
  {
    q: "How is my data handled?",
    a: "Each account is fully isolated in its own workspace. You can export or erase your data anytime from Settings → Data, and restrict access by domain for compliance."
  },
  {
    q: "What happens when many visitors chat at once?",
    a: "Chats auto-route to available agents by load, respecting each agent's chat limit. Overflow can be queued or converted into tickets so nothing is missed."
  }
];

export default function HelpPage() {
  return (
    <main className="min-h-screen bg-white text-[#111214]">
      <MarketingHeader />

      <section className="bg-[#111214] px-6 py-16 text-center text-white">
        <p className="text-sm font-bold uppercase tracking-wide text-[#FF5100]">Help center</p>
        <h1 className="mx-auto mt-3 max-w-2xl text-4xl font-bold md:text-5xl">How can we help?</h1>
        <div className="mx-auto mt-6 flex max-w-md items-center gap-2 rounded-xl bg-white px-4 py-3 text-slate-500">
          <Search className="h-5 w-5" aria-hidden />
          <input
            className="w-full bg-transparent text-sm text-slate-700 outline-none placeholder:text-slate-400"
            placeholder="Search for help…"
            aria-label="Search help articles"
          />
        </div>
      </section>

      <section className="mx-auto grid max-w-6xl gap-6 px-6 py-16 md:grid-cols-2 lg:grid-cols-3">
        {CATEGORIES.map((cat) => (
          <div className="rounded-2xl border border-slate-200 p-6 transition hover:shadow-md" key={cat.title}>
            <span className="grid h-11 w-11 place-items-center rounded-xl bg-[#fff0e8]">
              <cat.icon className="h-5 w-5 text-[#FF5100]" aria-hidden />
            </span>
            <h3 className="mt-4 text-lg font-bold">{cat.title}</h3>
            <p className="mt-2 text-sm text-slate-500">{cat.desc}</p>
          </div>
        ))}
      </section>

      <section className="mx-auto max-w-3xl px-6 pb-20">
        <h2 className="text-2xl font-bold">Frequently asked questions</h2>
        <div className="mt-6 space-y-3">
          {FAQ.map((item) => (
            <details className="group rounded-xl border border-slate-200 p-5" key={item.q}>
              <summary className="cursor-pointer list-none text-base font-semibold marker:content-none">
                <span className="flex items-center justify-between gap-4">
                  {item.q}
                  <span className="text-[#FF5100] transition group-open:rotate-45">+</span>
                </span>
              </summary>
              <p className="mt-3 text-sm text-slate-600">{item.a}</p>
            </details>
          ))}
        </div>

        <div className="mt-10 rounded-2xl bg-slate-50 p-8 text-center">
          <h3 className="text-lg font-bold">Still need help?</h3>
          <p className="mt-2 text-sm text-slate-500">Our team is one chat away — click the bubble in the corner.</p>
          <Link
            className="mt-5 inline-block rounded-lg bg-[#FF5100] px-6 py-3 text-sm font-bold text-white hover:bg-[#e64a00]"
            href="/register"
          >
            Start a free account
          </Link>
        </div>
      </section>

      <MarketingCta />
      <MarketingFooter />
    </main>
  );
}
