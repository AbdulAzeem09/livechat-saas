import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";
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
  title: pageTitle("Features"),
  description: "Every part of the product, grouped the way you would actually use it."
};

/**
 * Grouped the way a buyer evaluates, not the way the code is organised. Each group anchors
 * so the home page and footer can link straight to it.
 */
const GROUPS: Array<{
  id: string;
  eyebrow: string;
  title: string;
  copy: string;
  items: Array<{ name: string; copy: string }>;
}> = [
  {
    id: "chat",
    eyebrow: "Conversations",
    title: "The chat itself",
    copy:
      "Everything that happens between a customer asking and someone answering — including the parts nobody thinks about until they are missing.",
    items: [
      { name: "Real-time messaging", copy: "No refresh, across any number of servers." },
      { name: "Message sneak-peek", copy: "See what the customer is typing before they send it." },
      { name: "Internal notes", copy: "Talk to your team inside the chat. The customer never sees it." },
      { name: "File sharing", copy: "Both directions, with previews." },
      { name: "Delivery and read ticks", copy: "One tick sent, two when they have read it." },
      { name: "Canned responses", copy: "Saved replies, inserted with a shortcut." },
      { name: "Chat transfer", copy: "Hand over with the whole history attached." },
      { name: "Supervision", copy: "Watch a chat, or take it over." },
      { name: "Chat ratings", copy: "A thumb and a comment at the end." },
      { name: "Inactivity nudges", copy: "A gentle message when a chat goes quiet." },
      { name: "Card masking", copy: "Card numbers are hidden before they are ever stored." },
      { name: "Tags and archives", copy: "Every finished chat, searchable and labelled." }
    ]
  },
  {
    id: "ai",
    eyebrow: "AI agent",
    title: "The assistant behind the chat",
    copy:
      "It answers from your knowledge base and follows rules you wrote in plain words. It never invents policy, and it gets out of the way when a person is needed.",
    items: [
      { name: "Skills", copy: "Your rules — “never promise a refund, take the order number”." },
      { name: "Keyword scoping", copy: "A rule only reaches the model when it is relevant." },
      { name: "Knowledge base", copy: "Articles, PDF import, or pulled from your website." },
      { name: "Offline lead capture", copy: "Out of hours it takes a name and a number." },
      { name: "Resolution reporting", copy: "How many chats it finished without a person." },
      { name: "Chat summaries", copy: "What was asked and what to do next, in three lines." },
      { name: "Auto-tagging", copy: "Finished chats labelled by topic, for the reports." },
      { name: "Reply suggestions", copy: "A draft for the agent, based on your own content." },
      { name: "Text enhancement", copy: "Tidies a hurried reply without changing the facts." },
      { name: "Hand-over rules", copy: "Ask for a human and the assistant stops, for good." }
    ]
  },
  {
    id: "channels",
    eyebrow: "Channels",
    title: "Everywhere customers message you",
    copy: "All of it lands in the same inbox, with the same history and the same rules.",
    items: [
      { name: "Website widget", copy: "One line of code. Your colours, logo and greeting." },
      { name: "WhatsApp Business", copy: "Replies go back out to WhatsApp automatically." },
      { name: "Facebook Messenger", copy: "Connected from Settings, no developer needed." },
      { name: "Instagram", copy: "Direct messages in the same queue." },
      { name: "Email", copy: "Mail to support@ becomes a chat, and replies thread properly." },
      { name: "Chat link", copy: "No website? Share a link that opens a chat page." },
      { name: "Chat buttons", copy: "Turn any button on your site into a chat opener." },
      { name: "Multiple widgets", copy: "One per website, each with its own look and key." }
    ]
  },
  {
    id: "team",
    eyebrow: "Team",
    title: "Who answers, and when",
    copy: "So chats reach the right person, and nobody gets one on their day off.",
    items: [
      { name: "Roles and permissions", copy: "Owner, admin, manager, agent, viewer, billing." },
      { name: "Groups and departments", copy: "Route by what the chat is about." },
      { name: "Work scheduler", copy: "Weekly hours per agent. Off-shift means no new chats." },
      { name: "Chat limits", copy: "Cap how many a person handles at once." },
      { name: "Routing rules", copy: "Send chats by page, source, or keyword." },
      { name: "Availability", copy: "Online, away, busy — the widget reflects it." }
    ]
  },
  {
    id: "reports",
    eyebrow: "Reports",
    title: "What actually happened",
    copy:
      "Sixteen reports built on real numbers — never demo figures. Filter any of them by date, agent, tag, channel or status.",
    items: [
      { name: "Chat volume and duration", copy: "Over any range you pick." },
      { name: "Missed chats", copy: "The ones nobody answered, which is the number that matters." },
      { name: "Agent performance", copy: "Response times and workload, per person." },
      { name: "Revenue per chat", copy: "What each conversation was worth, credited to an agent." },
      { name: "AI performance", copy: "Resolutions, hand-overs, and the share done alone." },
      { name: "Satisfaction and tags", copy: "Ratings, and what people keep asking about." },
      { name: "CSV export", copy: "Everything, properly escaped." },
      { name: "Scheduled emails", copy: "The numbers in your inbox every Monday." },
      { name: "Reports API", copy: "Pull it into your own dashboard with a key." }
    ]
  },
  {
    id: "integrations",
    eyebrow: "Integrations",
    title: "Connects to what you already run",
    copy: "And an API for whatever is not on the list.",
    items: [
      { name: "Shopify", copy: "The customer's recent orders, right in the chat." },
      { name: "Slack", copy: "A new chat pings the channel you choose." },
      { name: "HubSpot", copy: "Customers pushed across when a chat is resolved." },
      { name: "Webhooks", copy: "Outgoing events, with retries." },
      { name: "REST API", copy: "Keys and revocation that takes effect immediately." },
      { name: "Customer SDK", copy: "Build your own chat interface on our plumbing." },
      { name: "Widget JS API", copy: "Open, hide, prefill the customer, listen for events." }
    ]
  }
];

export default function FeaturesPage() {
  return (
    <div className="min-h-screen bg-white text-[#0B1524]">
      <MarketingHeader />
      <SiteChat />

      <PageHero
        eyebrow="Product"
        title="Everything in the box"
        copy={`Every plan includes every feature below. ${BRAND.name} does not keep the useful parts behind an enterprise tier.`}
      >
        <div className="flex flex-wrap gap-2.5">
          {GROUPS.map((group) => (
            <a
              className="rounded-lg border border-[#CBD6E6] px-3.5 py-2 text-[14px] font-medium text-[#1D2B3E] transition-colors hover:border-[#0067FF] hover:text-[#0067FF]"
              href={`#${group.id}`}
              key={group.id}
            >
              {group.eyebrow}
            </a>
          ))}
        </div>
      </PageHero>

      {GROUPS.map((group, index) => (
        <Section key={group.id} tint={index % 2 === 1}>
          <div className="scroll-mt-20" id={group.id}>
            <SectionHead copy={group.copy} eyebrow={group.eyebrow} title={group.title} />
            <ul className="mt-9 grid gap-x-10 gap-y-5 sm:grid-cols-2 lg:grid-cols-3">
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
          </div>
        </Section>
      ))}

      <Section>
        <div className="rounded-2xl border border-[#E3E9F2] bg-[#F7F9FC] p-8 md:p-10">
          <SectionHead
            copy="Tell us what you need it to do and we will tell you straight whether it does — including when it does not."
            title="Not sure it covers your case?"
          />
          <Link
            className="mt-6 inline-flex items-center gap-2 rounded-lg bg-[#0067FF] px-5 py-2.5 text-[15px] font-semibold text-white transition-colors hover:bg-[#0050C7]"
            href="/contact"
          >
            Ask us <ArrowRight aria-hidden className="h-4 w-4" />
          </Link>
        </div>
      </Section>

      <MarketingCta />
      <MarketingFooter />
    </div>
  );
}
