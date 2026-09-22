import type { Metadata } from "next";
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
  title: pageTitle("About"),
  description: `Why ${BRAND.name} exists and how it is built.`
};

const BELIEFS = [
  {
    title: "Every feature on every plan",
    copy:
      "Charging extra for single sign-on or an audit log punishes the customers who care most about doing things properly. The price changes with how many people answer chats, and nothing else."
  },
  {
    title: "Say what it cannot do",
    copy:
      "Our security page lists what is missing alongside what is there. A buyer who discovers a gap on their own stops believing the rest of the page too."
  },
  {
    title: "Numbers that are real",
    copy:
      "No demo figures anywhere in the product. If a report says eleven chats, eleven chats happened — and the tests check exactly that, because a dashboard full of plausible fiction is worse than no dashboard."
  },
  {
    title: "The assistant stays in its lane",
    copy:
      "It answers from your knowledge base and follows rules you wrote. It does not improvise policy, and it hands over the moment someone asks for a person."
  }
];

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-white text-[#0B1524]">
      <MarketingHeader />
      <SiteChat />

      <PageHero
        copy="Live chat software got expensive and complicated at the same time. Small teams ended up paying enterprise prices for features they were then locked out of."
        eyebrow="About"
        title={`Why ${BRAND.name} exists`}
      />

      <Section>
        <SectionHead
          copy="These are the decisions we would not reverse to win a deal."
          title="What we hold to"
        />
        <div className="mt-9 grid gap-x-12 gap-y-9 md:grid-cols-2">
          {BELIEFS.map((belief) => (
            <div key={belief.title}>
              <h3 className="text-[17px] font-bold">{belief.title}</h3>
              <p className="mt-2 text-[15px] leading-relaxed text-[#5B6B82]">{belief.copy}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section tint>
        <SectionHead title="How it is built" />
        <div className="mt-8 grid gap-8 md:grid-cols-3">
          {[
            {
              title: "Tested before it ships",
              copy:
                "Every feature has automated checks written as plain sentences — “internal note NOT shown to visitor” — and the whole suite runs before anything is released."
            },
            {
              title: "Yours to host",
              copy:
                "Run it on our servers, or on your own with a setup script. Same product either way, and your data stays wherever you decided it should."
            },
            {
              title: "Small on purpose",
              copy:
                "You will get answers from the people who wrote the code, not a tier-one script. That stops being true at some size, and we would rather it stayed true."
            }
          ].map((item) => (
            <div key={item.title}>
              <h3 className="text-[17px] font-bold">{item.title}</h3>
              <p className="mt-2 text-[15px] leading-relaxed text-[#5B6B82]">{item.copy}</p>
            </div>
          ))}
        </div>
      </Section>

      <MarketingCta />
      <MarketingFooter />
    </div>
  );
}
