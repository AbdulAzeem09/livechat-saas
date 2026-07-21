import Link from "next/link";
import { ArrowRight, BookOpen, FileText, GraduationCap, Newspaper, Video } from "lucide-react";
import { MarketingCta, MarketingFooter, MarketingHeader } from "@/components/marketing/marketing-chrome";

const FEATURED = {
  tag: "Guide",
  title: "The complete guide to live chat support in 2026",
  copy: "How to set up chat, write great canned responses, train your chatbot, and measure CSAT — a step-by-step playbook for new teams.",
  read: "12 min read"
};

const POSTS = [
  { icon: BookOpen, tag: "Playbook", title: "10 canned responses every support team needs", read: "6 min" },
  { icon: Video, tag: "Tutorial", title: "Setting up your chat widget in 5 minutes", read: "Watch" },
  { icon: GraduationCap, tag: "Academy", title: "Chatbot 101: greetings, keywords & knowledge base", read: "8 min" },
  { icon: Newspaper, tag: "Blog", title: "How proactive chat lifts conversion by 3x", read: "5 min" },
  { icon: FileText, tag: "Template", title: "Pre-chat & post-chat form templates that convert", read: "4 min" },
  { icon: BookOpen, tag: "Playbook", title: "Measuring support: CSAT, first response & resolution", read: "7 min" }
];

export default function ResourcesPage() {
  return (
    <main className="min-h-screen bg-white text-[#111214]">
      <MarketingHeader />

      <section className="mx-auto max-w-4xl px-6 py-16 text-center">
        <p className="text-sm font-bold uppercase tracking-wide text-[#FF5100]">Resources</p>
        <h1 className="mx-auto mt-3 max-w-2xl text-4xl font-bold md:text-5xl">Learn to chat like a pro</h1>
        <p className="mx-auto mt-4 max-w-lg text-slate-500">
          Guides, tutorials, and templates to get more from every conversation.
        </p>
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-8">
        <div className="grid items-center gap-8 rounded-2xl bg-[#111214] p-8 text-white md:grid-cols-2 md:p-12">
          <div>
            <span className="rounded-full bg-[#FF5100] px-3 py-1 text-xs font-bold">{FEATURED.tag}</span>
            <h2 className="mt-4 text-2xl font-bold md:text-3xl">{FEATURED.title}</h2>
            <p className="mt-3 text-sm text-white/60">{FEATURED.copy}</p>
            <div className="mt-5 flex items-center gap-4">
              <Link
                className="inline-flex items-center gap-2 rounded-lg bg-[#FF5100] px-5 py-2.5 text-sm font-bold hover:bg-[#e64a00]"
                href="/register"
              >
                Read the guide <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
              <span className="text-xs text-white/40">{FEATURED.read}</span>
            </div>
          </div>
          <div className="hidden h-48 rounded-xl bg-gradient-to-br from-[#FF5100]/30 to-transparent md:block" />
        </div>
      </section>

      <section className="mx-auto grid max-w-6xl gap-6 px-6 pb-20 md:grid-cols-2 lg:grid-cols-3">
        {POSTS.map((post) => (
          <article className="rounded-2xl border border-slate-200 p-6 transition hover:shadow-md" key={post.title}>
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#fff0e8]">
              <post.icon className="h-5 w-5 text-[#FF5100]" aria-hidden />
            </span>
            <p className="mt-4 text-xs font-bold uppercase tracking-wide text-[#FF5100]">{post.tag}</p>
            <h3 className="mt-2 text-lg font-bold leading-snug">{post.title}</h3>
            <p className="mt-3 text-xs text-slate-400">{post.read}</p>
          </article>
        ))}
      </section>

      <MarketingCta />
      <MarketingFooter />
    </main>
  );
}
