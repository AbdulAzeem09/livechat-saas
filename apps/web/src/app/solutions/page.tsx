import Link from "next/link";
import { Check, Headphones, Rocket, ShieldCheck } from "lucide-react";
import { MarketingCta, MarketingFooter, MarketingHeader } from "@/components/marketing/marketing-chrome";

const SOLUTIONS = [
  {
    icon: Headphones,
    tag: "Customer support",
    title: "Support that never misses a chat",
    copy: "Answer faster with canned responses, chatbots, and AI. Route chats to the right agent and turn tough cases into tickets.",
    points: ["24/7 chatbot + knowledge base", "Auto-routing & departments", "CSAT ratings & reports", "Ticketing for follow-ups"]
  },
  {
    icon: Rocket,
    tag: "Sales & marketing",
    title: "Turn visitors into customers",
    copy: "See who's on your site in real time, greet them with proactive campaigns, and track goals & sales from every chat.",
    points: ["Live visitor tracking + geo", "Eye-catchers & campaigns", "Goals & sales tracker", "Product cards in chat"]
  },
  {
    icon: ShieldCheck,
    tag: "Enterprise",
    title: "Scale with security & control",
    copy: "Roles & permissions, domain restrictions, data export/erasure, working hours, and an admin panel across all your teams.",
    points: ["RBAC roles & permissions", "Trusted-domain security", "GDPR data controls", "Super-admin panel"]
  }
];

export default function SolutionsPage() {
  return (
    <main className="min-h-screen bg-white text-[#111214]">
      <MarketingHeader />

      <section className="mx-auto max-w-4xl px-6 py-16 text-center">
        <p className="text-sm font-bold uppercase tracking-wide text-[#FF5100]">Solutions</p>
        <h1 className="mx-auto mt-3 max-w-2xl text-4xl font-bold md:text-5xl">Built for every team</h1>
        <p className="mx-auto mt-4 max-w-lg text-slate-500">
          Whether you support, sell, or scale — LiveChat fits your workflow.
        </p>
      </section>

      <section className="mx-auto max-w-6xl space-y-8 px-6 pb-20">
        {SOLUTIONS.map((s, i) => (
          <div
            className="grid items-center gap-8 rounded-2xl border border-slate-200 p-8 md:grid-cols-2"
            key={s.tag}
          >
            <div className={i % 2 === 1 ? "md:order-2" : ""}>
              <span className="inline-flex items-center gap-2 rounded-full bg-[#fff0e8] px-3 py-1 text-xs font-bold text-[#FF5100]">
                <s.icon className="h-3.5 w-3.5" aria-hidden /> {s.tag}
              </span>
              <h3 className="mt-4 text-2xl font-bold">{s.title}</h3>
              <p className="mt-3 text-slate-600">{s.copy}</p>
              <Link
                className="mt-5 inline-block rounded-lg bg-[#FF5100] px-5 py-2.5 text-sm font-bold text-white hover:bg-[#e64a00]"
                href="/register"
              >
                Get started
              </Link>
            </div>
            <ul className={`space-y-3 ${i % 2 === 1 ? "md:order-1" : ""}`}>
              {s.points.map((p) => (
                <li className="flex items-center gap-3 rounded-lg bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700" key={p}>
                  <Check className="h-4 w-4 shrink-0 text-emerald-500" aria-hidden />
                  {p}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </section>

      <MarketingCta />
      <MarketingFooter />
    </main>
  );
}
