import Link from "next/link";
import { MessageSquareText } from "lucide-react";

const NAV = [
  { label: "Features", href: "/features" },
  { label: "Solutions", href: "/solutions" },
  { label: "Pricing", href: "/pricing" },
  { label: "Compare", href: "/compare" },
  { label: "Resources", href: "/resources" },
  { label: "Help", href: "/help" }
];

export function MarketingHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-slate-100 bg-white/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <Link className="flex items-center gap-2" href="/">
          <span className="grid h-9 w-9 place-items-center rounded-lg bg-[#FF5100] text-white">
            <MessageSquareText className="h-5 w-5" aria-hidden />
          </span>
          <span className="text-lg font-bold text-[#111214]">LiveChat</span>
        </Link>
        <nav className="hidden items-center gap-1 text-sm font-semibold text-slate-600 lg:flex">
          {NAV.map((item) => (
            <Link className="rounded-lg px-3 py-2 hover:bg-slate-100" href={item.href} key={item.href}>
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-2 text-sm font-semibold">
          <Link className="rounded-lg px-4 py-2 hover:bg-slate-100" href="/login">
            Log in
          </Link>
          <Link className="rounded-lg bg-[#FF5100] px-4 py-2 text-white hover:bg-[#e64a00]" href="/register">
            Sign up free
          </Link>
        </div>
      </div>
    </header>
  );
}

export function MarketingFooter() {
  return (
    <footer className="border-t border-slate-100 bg-slate-50">
      <div className="mx-auto grid max-w-6xl gap-8 px-6 py-12 md:grid-cols-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-[#FF5100] text-white">
              <MessageSquareText className="h-4 w-4" aria-hidden />
            </span>
            <span className="font-bold">LiveChat</span>
          </div>
          <p className="mt-3 text-sm text-slate-500">Chat with customers in real time.</p>
        </div>
        {([
          { title: "Product", links: [["Features", "/features"], ["Pricing", "/pricing"], ["Compare", "/compare"]] },
          { title: "Solutions", links: [["Customer support", "/solutions"], ["Sales", "/solutions"], ["Enterprise", "/solutions"]] },
          { title: "Company", links: [["Resources", "/resources"], ["Help center", "/help"], ["Sign up", "/register"]] }
        ] as { title: string; links: [string, string][] }[]).map((col) => (
          <div key={col.title}>
            <p className="text-sm font-bold text-slate-700">{col.title}</p>
            <ul className="mt-3 space-y-2 text-sm text-slate-500">
              {col.links.map(([label, href]) => (
                <li key={label}>
                  <Link className="hover:text-[#FF5100]" href={href}>
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t border-slate-100 px-6 py-6 text-center text-xs text-slate-400">
        © 2026 LiveChat clone — built with Next.js &amp; NestJS.
      </div>
    </footer>
  );
}

export function MarketingCta() {
  return (
    <section className="bg-[#111214] px-6 py-16 text-center text-white">
      <h2 className="mx-auto max-w-xl text-3xl font-bold">Ready to talk to your customers?</h2>
      <p className="mx-auto mt-3 max-w-md text-sm text-white/60">Launch your chat widget in minutes.</p>
      <Link
        className="mt-6 inline-block rounded-lg bg-[#FF5100] px-6 py-3 text-sm font-bold text-white hover:bg-[#e64a00]"
        href="/register"
      >
        Get started free
      </Link>
    </section>
  );
}
