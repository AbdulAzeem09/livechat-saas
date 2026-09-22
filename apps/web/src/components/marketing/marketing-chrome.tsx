import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowRight, Check, MessagesSquare } from "lucide-react";
import { BRAND, FOOTER_COLUMNS, HAS_SUPPORT_EMAIL, MARKETING_NAV } from "@/lib/brand";

export function BrandMark({ size = "md" }: { size?: "sm" | "md" }) {
  const box = size === "sm" ? "h-8 w-8" : "h-9 w-9";
  const glyph = size === "sm" ? "h-4 w-4" : "h-[18px] w-[18px]";

  return (
    <span className="flex items-center gap-2">
      <span className={`grid ${box} place-items-center rounded-[10px] bg-[#0067FF] text-white`}>
        <MessagesSquare className={glyph} aria-hidden />
      </span>
      <span className="text-[17px] font-bold tracking-[-0.01em] text-[#0B1524]">{BRAND.name}</span>
    </span>
  );
}

export function MarketingHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-[#E3E9F2] bg-white/85 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center gap-6 px-5 py-3.5 md:px-8">
        <Link aria-label={`${BRAND.name} home`} href="/">
          <BrandMark />
        </Link>

        <nav className="hidden flex-1 items-center gap-0.5 text-[14px] font-medium text-[#3D4E63] lg:flex">
          {MARKETING_NAV.map((item) => (
            <Link
              className="rounded-lg px-3 py-2 transition-colors hover:bg-[#F1F5FB] hover:text-[#0B1524]"
              href={item.href}
              key={item.href}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-1.5 text-[14px] font-semibold lg:ml-0">
          <Link
            className="rounded-lg px-3.5 py-2 text-[#3D4E63] transition-colors hover:bg-[#F1F5FB]"
            href="/login"
          >
            Log in
          </Link>
          <Link
            className="rounded-lg bg-[#0067FF] px-4 py-2 text-white transition-colors hover:bg-[#0050C7]"
            href="/register"
          >
            Start free
          </Link>
        </div>
      </div>
    </header>
  );
}

export function MarketingFooter() {
  return (
    <footer className="border-t border-[#E3E9F2] bg-[#F7F9FC]">
      <div className="mx-auto grid max-w-6xl gap-10 px-5 py-14 md:grid-cols-[1.4fr_repeat(3,1fr)] md:px-8">
        <div className="max-w-xs">
          <BrandMark size="sm" />
          <p className="mt-3 text-[14px] leading-relaxed text-[#5B6B82]">{BRAND.summary}</p>
          {HAS_SUPPORT_EMAIL ? (
            <a
              className="mt-4 inline-block text-[14px] font-medium text-[#0067FF] hover:underline"
              href={`mailto:${BRAND.email}`}
            >
              {BRAND.email}
            </a>
          ) : (
            <Link
              className="mt-4 inline-block text-[14px] font-medium text-[#0067FF] hover:underline"
              href="/contact"
            >
              Get in touch
            </Link>
          )}
        </div>

        {FOOTER_COLUMNS.map((column) => (
          <div key={column.title}>
            <p className="text-[13px] font-bold text-[#0B1524]">{column.title}</p>
            <ul className="mt-3.5 grid gap-2.5 text-[14px] text-[#5B6B82]">
              {column.links.map(([label, href]) => (
                <li key={label}>
                  <Link className="transition-colors hover:text-[#0067FF]" href={href}>
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="border-t border-[#E3E9F2] px-5 py-6 md:px-8">
        <p className="mx-auto max-w-6xl text-[13px] text-[#8494A8]">
          © {new Date().getFullYear()} {BRAND.name}. All rights reserved.
        </p>
      </div>
    </footer>
  );
}

export function MarketingCta({
  heading = "Start answering customers today",
  copy = `Install the widget in one line, invite your team, and try everything free for ${BRAND.trialDays} days.`
}: {
  heading?: string;
  copy?: string;
}) {
  return (
    <section className="bg-[#0B1524] px-5 py-20 md:px-8">
      <div className="mx-auto max-w-2xl text-center">
        <h2 className="text-balance text-[30px] font-bold leading-[1.15] text-white md:text-[36px]">
          {heading}
        </h2>
        <p className="mx-auto mt-4 max-w-md text-[15px] leading-relaxed text-white/60">{copy}</p>
        <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
          <Link
            className="inline-flex items-center gap-2 rounded-lg bg-[#0067FF] px-6 py-3 text-[15px] font-semibold text-white transition-colors hover:bg-[#0050C7]"
            href="/register"
          >
            Start free <ArrowRight aria-hidden className="h-4 w-4" />
          </Link>
          <Link
            className="rounded-lg border border-white/20 px-6 py-3 text-[15px] font-semibold text-white transition-colors hover:bg-white/5"
            href="/contact"
          >
            Talk to us
          </Link>
        </div>
        <p className="mt-5 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-[13px] text-white/45">
          {["No card needed", "Set up in 5 minutes", "Cancel any time"].map((item) => (
            <span className="flex items-center gap-1.5" key={item}>
              <Check aria-hidden className="h-3.5 w-3.5 text-[#4ADE80]" /> {item}
            </span>
          ))}
        </p>
      </div>
    </section>
  );
}

/* ---------------------------------------------------------------- page pieces */

/** The top of an inside page: one label, one promise, one sentence. */
export function PageHero({
  eyebrow,
  title,
  copy,
  children
}: {
  eyebrow: string;
  title: string;
  copy: string;
  children?: ReactNode;
}) {
  return (
    <section className="border-b border-[#E3E9F2] bg-white px-5 py-16 md:px-8 md:py-20">
      <div className="mx-auto max-w-6xl">
        <p className="text-[12px] font-bold uppercase tracking-[0.1em] text-[#0067FF]">{eyebrow}</p>
        <h1 className="mt-3 max-w-3xl text-balance text-[34px] font-bold leading-[1.1] tracking-[-0.02em] text-[#0B1524] md:text-[46px]">
          {title}
        </h1>
        <p className="mt-5 max-w-2xl text-[17px] leading-relaxed text-[#5B6B82]">{copy}</p>
        {children ? <div className="mt-8">{children}</div> : null}
      </div>
    </section>
  );
}

export function Section({
  children,
  tint = false
}: {
  children: ReactNode;
  tint?: boolean;
}) {
  return (
    <section className={`px-5 py-16 md:px-8 md:py-20 ${tint ? "bg-[#F7F9FC]" : "bg-white"}`}>
      <div className="mx-auto max-w-6xl">{children}</div>
    </section>
  );
}

export function SectionHead({
  eyebrow,
  title,
  copy
}: {
  eyebrow?: string;
  title: string;
  copy?: string;
}) {
  return (
    <div className="max-w-2xl">
      {eyebrow ? (
        <p className="text-[12px] font-bold uppercase tracking-[0.1em] text-[#0067FF]">{eyebrow}</p>
      ) : null}
      <h2 className="mt-2.5 text-balance text-[27px] font-bold leading-[1.2] tracking-[-0.015em] text-[#0B1524] md:text-[32px]">
        {title}
      </h2>
      {copy ? <p className="mt-4 text-[16px] leading-relaxed text-[#5B6B82]">{copy}</p> : null}
    </div>
  );
}
