/**
 * Everything about how the product presents itself, in one place.
 *
 * Change the name, the colour or the contact details here and the whole marketing site,
 * the auth screens and the page titles follow. Nothing else should hard-code the brand.
 */
export const BRAND = {
  name: "Chatme",
  /** Used in page titles: "Pricing — Chatme". */
  tagline: "Live chat and an AI agent for your website",
  /** One sentence, for the footer and meta descriptions. */
  summary:
    "Answer customers the moment they ask, on your website and on WhatsApp, with an assistant that handles the rest.",
  /**
   * The address customers write to. Set NEXT_PUBLIC_SUPPORT_EMAIL at build time and it is
   * used everywhere — footer, contact page, and the reply-to on outgoing mail.
   */
  email: process.env.NEXT_PUBLIC_SUPPORT_EMAIL || "support@example.com",
  /** Shown on the pricing page and in the trial banners. */
  trialDays: 14
} as const;

/** True once a real address is configured — screens hide the contact details until then. */
export const HAS_SUPPORT_EMAIL = BRAND.email !== "support@example.com";

/**
 * The palette. Blue rather than the usual support-software orange, and the same blue the
 * dashboard already uses — so the site and the product a customer signs into look like one
 * thing rather than two.
 */
export const COLORS = {
  ink: "#0B1524",
  inkSoft: "#1D2B3E",
  muted: "#5B6B82",
  border: "#E3E9F2",
  surface: "#F7F9FC",
  accent: "#0067FF",
  accentHover: "#0050C7",
  accentTint: "#EEF3FF",
  positive: "#0E8A5F"
} as const;

export const MARKETING_NAV = [
  { label: "Product", href: "/features" },
  { label: "Solutions", href: "/solutions" },
  { label: "Pricing", href: "/pricing" },
  { label: "Compare", href: "/compare" },
  { label: "Security", href: "/security" },
  { label: "Resources", href: "/resources" }
] as const;

export const FOOTER_COLUMNS: Array<{ title: string; links: Array<[string, string]> }> = [
  {
    title: "Product",
    links: [
      ["Features", "/features"],
      ["Pricing", "/pricing"],
      ["Security", "/security"],
      ["Compare", "/compare"]
    ]
  },
  {
    title: "Solutions",
    links: [
      ["Online shops", "/solutions#shops"],
      ["Services", "/solutions#services"],
      ["Support teams", "/solutions#support"],
      ["Sales teams", "/solutions#sales"]
    ]
  },
  {
    title: "Company",
    links: [
      ["About", "/about"],
      ["Contact", "/contact"],
      ["Help centre", "/help"],
      ["Resources", "/resources"]
    ]
  }
];

/** Page title helper, so every page is titled the same way. */
export function pageTitle(page: string): string {
  return `${page} — ${BRAND.name}`;
}
