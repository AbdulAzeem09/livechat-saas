import type { Metadata } from "next";
import Link from "next/link";
import { Check, Minus } from "lucide-react";
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
  title: pageTitle("Security"),
  description: "How sign-in, data and access are handled — including what is not in place yet."
};

const GROUPS = [
  {
    title: "Signing in",
    items: [
      { name: "Two-factor authentication", copy: "Any authenticator app, with one-time recovery codes." },
      { name: "Single sign-on", copy: "Google, Microsoft, or any OpenID Connect provider." },
      { name: "Password rules", copy: "Length, letters and digits, no common passwords, not your own email." },
      { name: "Account lockout", copy: "Repeated wrong passwords lock the account for fifteen minutes." },
      { name: "Access restriction", copy: "Limit the dashboard to your office network, by address or range." }
    ]
  },
  {
    title: "Your data",
    items: [
      { name: "Encrypted secrets", copy: "Channel tokens, SSO secrets and app keys are AES-256-GCM encrypted at rest." },
      { name: "Card masking", copy: "A card number typed into a chat is masked before it is ever written down." },
      { name: "Workspace isolation", copy: "One workspace can never read another's data. Checked on every route, in every test run." },
      { name: "Export and deletion", copy: "Take your data out, or have it removed, whenever you ask." },
      { name: "Nightly backups", copy: "Automatic database backups on self-hosted installs." }
    ]
  },
  {
    title: "Watching the system",
    items: [
      { name: "Audit log", copy: "Who signed in, who changed what, and when." },
      { name: "Health endpoint", copy: "Database, memory and error counts, for your own monitoring." },
      { name: "Failed sign-in alerts", copy: "A rising number of failures emails the owners." },
      { name: "Rate limiting", copy: "Per address, on sign-in, registration and the widget." },
      { name: "Outbound request guard", copy: "Webhooks and imports cannot be pointed at internal addresses." }
    ]
  }
];

/**
 * Saying plainly what is missing is worth more than a wall of ticks. A buyer who finds the
 * gap themselves stops trusting the ticks as well.
 */
const NOT_YET = [
  { name: "SOC 2 / ISO 27001", copy: "Not certified. The controls are in place; the audit is not done." },
  { name: "EU data residency", copy: "Choose your own region on a self-hosted install; not offered as a managed option." },
  { name: "HIPAA", copy: "No BAA available. Do not put protected health information in chats." }
];

export default function SecurityPage() {
  return (
    <div className="min-h-screen bg-white text-[#0B1524]">
      <MarketingHeader />
      <SiteChat />

      <PageHero
        copy={`What is in place, how it works, and — further down — what is not. ${BRAND.name} would rather lose a deal than be vague about this.`}
        eyebrow="Security"
        title="The answers your IT team will ask for"
      />

      {GROUPS.map((group, index) => (
        <Section key={group.title} tint={index % 2 === 1}>
          <SectionHead title={group.title} />
          <ul className="mt-8 grid gap-x-10 gap-y-6 md:grid-cols-2">
            {group.items.map((item) => (
              <li className="flex gap-3" key={item.name}>
                <Check aria-hidden className="mt-1 h-4 w-4 flex-none text-[#0E8A5F]" />
                <span>
                  <span className="block text-[15px] font-semibold">{item.name}</span>
                  <span className="mt-0.5 block text-[14px] leading-relaxed text-[#5B6B82]">
                    {item.copy}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </Section>
      ))}

      <Section>
        <SectionHead
          copy="If any of these is a requirement for you, say so before you start a trial and we will tell you where it stands."
          title="What is not in place"
        />
        <ul className="mt-8 grid gap-6 md:grid-cols-3">
          {NOT_YET.map((item) => (
            <li className="rounded-xl border border-[#E3E9F2] bg-[#F7F9FC] p-5" key={item.name}>
              <Minus aria-hidden className="h-4 w-4 text-[#A15C00]" />
              <p className="mt-2.5 text-[15px] font-semibold">{item.name}</p>
              <p className="mt-1 text-[14px] leading-relaxed text-[#5B6B82]">{item.copy}</p>
            </li>
          ))}
        </ul>
        <p className="mt-8 text-[15px] text-[#5B6B82]">
          Found something that looks wrong?{" "}
          <Link className="font-semibold text-[#0067FF] hover:underline" href="/contact">
            Tell us
          </Link>{" "}
          — we would rather hear it from you than from a customer.
        </p>
      </Section>

      <MarketingCta
        copy="Start a trial, or send your security questionnaire over and we will fill it in."
        heading="Happy to go deeper"
      />
      <MarketingFooter />
    </div>
  );
}
