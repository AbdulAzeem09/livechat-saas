/**
 * Optional paid add-ons a client can enable on top of their plan. Kept as a
 * simple in-code catalog (no table); an org's active add-ons live in
 * organization.metadata.addons as { [code]: true }.
 */
export interface AddonDefinition {
  code: string;
  name: string;
  description: string;
  priceCents: number;
}

export const ADDON_CATALOG: AddonDefinition[] = [
  {
    code: "legal",
    name: "Legal AI Receptionist",
    description:
      "Turn the assistant into a compliant legal-intake receptionist: no legal advice, timestamped disclaimer, conflict / jurisdiction / statute-of-limitations checks, and bilingual EN/ES intake.",
    priceCents: 4900
  }
];

export function findAddon(code: string): AddonDefinition | undefined {
  return ADDON_CATALOG.find((addon) => addon.code === code);
}

/** Read the set of active add-on codes from an organization's metadata. */
export function activeAddonCodes(metadata: unknown): string[] {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return [];
  }
  const addons = (metadata as Record<string, unknown>).addons;
  if (!addons || typeof addons !== "object" || Array.isArray(addons)) {
    return [];
  }
  return Object.entries(addons as Record<string, unknown>)
    .filter(([, value]) => value === true)
    .map(([key]) => key);
}
