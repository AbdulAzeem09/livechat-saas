import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, BookOpen, Mail, MessagesSquare, ShieldCheck } from "lucide-react";
import {
  MarketingFooter,
  MarketingHeader,
  PageHero,
  Section,
  SectionHead
} from "@/components/marketing/marketing-chrome";
import { SiteChat } from "@/components/marketing/site-chat";
import { BRAND, HAS_SUPPORT_EMAIL, pageTitle } from "@/lib/brand";

export const metadata: Metadata = {
  title: pageTitle("Contact"),
  description: `Talk to the people who build ${BRAND.name}.`
};

export default function ContactPage() {
  return (
    <div className="min-h-screen bg-white text-[#0B1524]">
      <MarketingHeader />
      <SiteChat />

      <PageHero
        copy="The quickest way is the chat in the corner of this page — it is the same product you are looking at, answered by the people who build it."
        eyebrow="Contact"
        title="Talk to us"
      />

      {/* Chat first: a chat company that hides behind a contact form is not a good sign. */}
      <Section>
        <div className="grid gap-5 lg:grid-cols-[1.2fr_1fr]">
          <div className="rounded-2xl border border-[#0067FF] bg-[#EEF3FF] p-8">
            <span className="grid h-11 w-11 place-items-center rounded-xl bg-[#0067FF]">
              <MessagesSquare aria-hidden className="h-5 w-5 text-white" />
            </span>
            <h2 className="mt-5 text-[21px] font-bold">Chat with us</h2>
            <p className="mt-2 max-w-md text-[15px] leading-relaxed text-[#3D4E63]">
              Open the bubble at the bottom of this page. During working hours a person replies;
              outside them the assistant takes your details and we come back to you.
            </p>
            <p className="mt-4 text-[13px] text-[#5B6B82]">
              You are also watching the product work — this is our own widget, set up the same way
              yours would be.
            </p>
          </div>

          <div className="grid gap-5">
            <ContactCard
              copy="Installing the widget, connecting WhatsApp, or moving across from another tool."
              href="/help"
              icon={BookOpen}
              label="Read the help centre"
              title="Setting it up"
            />
            <ContactCard
              copy="Questionnaires, data questions, or something that looks wrong to you."
              href="/security"
              icon={ShieldCheck}
              label="Read the security page"
              title="Security and compliance"
            />
            {HAS_SUPPORT_EMAIL ? (
              <ContactCard
                copy="If you would rather write, this reaches the same people."
                href={`mailto:${BRAND.email}`}
                icon={Mail}
                label={BRAND.email}
                title="Email"
              />
            ) : null}
          </div>
        </div>
      </Section>

      <Section tint>
        <SectionHead
          copy="Already using it? Open the chat inside your dashboard instead — it arrives with your account and your workspace attached, so nobody has to ask you which one you are."
          title="If you are already a customer"
        />
        <Link
          className="mt-6 inline-flex items-center gap-2 rounded-lg bg-[#0067FF] px-5 py-2.5 text-[15px] font-semibold text-white transition-colors hover:bg-[#0050C7]"
          href="/login"
        >
          Sign in <ArrowRight aria-hidden className="h-4 w-4" />
        </Link>
      </Section>

      <MarketingFooter />
    </div>
  );
}

function ContactCard({
  copy,
  href,
  icon: Icon,
  label,
  title
}: {
  copy: string;
  href: string;
  icon: typeof Mail;
  label: string;
  title: string;
}) {
  const external = href.startsWith("mailto:");

  return (
    <div className="rounded-2xl border border-[#E3E9F2] p-6">
      <Icon aria-hidden className="h-5 w-5 text-[#0067FF]" />
      <h3 className="mt-3.5 text-[16px] font-bold">{title}</h3>
      <p className="mt-1.5 text-[14px] leading-relaxed text-[#5B6B82]">{copy}</p>
      {external ? (
        <a
          className="mt-3 inline-flex items-center gap-1.5 text-[14px] font-semibold text-[#0067FF] hover:underline"
          href={href}
        >
          {label} <ArrowRight aria-hidden className="h-3.5 w-3.5" />
        </a>
      ) : (
        <Link
          className="mt-3 inline-flex items-center gap-1.5 text-[14px] font-semibold text-[#0067FF] hover:underline"
          href={href}
        >
          {label} <ArrowRight aria-hidden className="h-3.5 w-3.5" />
        </Link>
      )}
    </div>
  );
}
