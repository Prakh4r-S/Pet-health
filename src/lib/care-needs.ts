/**
 * The reasons an owner most often comes looking for a vet, as a short
 * list they can pick from instead of knowing which specialism to ask
 * for. Nobody searching at 11pm knows that an itchy dog is
 * "dermatology".
 *
 * No server-only imports: the directory, the matcher and the booking
 * form all read this.
 */

export type CareNeed = {
  slug: string;
  /** What the chip says. */
  label: string;
  /** What is put in the booking form's "primary concern" to start the owner off. */
  concern: string;
  /** Curated specialisations that deal with it. */
  specialisations: string[];
  /** Word stems to look for in a vet's own specialties and bio. */
  terms: string[];
  /**
   * True when any vet can help and the specialisms above are only a
   * preference: choosing the chip then reorders the list rather than
   * shortening it.
   */
  anyVet: boolean;
};

export const CARE_NEEDS: CareNeed[] = [
  {
    slug: "stomach",
    label: "Vomiting / Not eating",
    concern: "Vomiting / not eating",
    specialisations: ["general-practice", "nutrition", "emergency"],
    terms: ["gastro", "digest", "vomit", "stomach", "internal medicine", "appetite"],
    anyVet: true,
  },
  {
    slug: "skin",
    label: "Skin & itching",
    concern: "Skin problem / itching",
    specialisations: ["dermatology"],
    terms: ["dermat", "skin", "allerg", "itch"],
    anyVet: false,
  },
  {
    slug: "injury",
    label: "Limping / Injury",
    concern: "Limping / injury",
    specialisations: ["orthopaedics", "emergency"],
    terms: ["orthop", "surg", "joint", "fracture", "injur", "lame"],
    anyVet: false,
  },
  {
    slug: "checkup",
    label: "Vaccination & checkup",
    concern: "Vaccination / routine check-up",
    specialisations: ["general-practice"],
    terms: ["vaccin", "prevent", "wellness", "check-up", "checkup", "routine"],
    anyVet: true,
  },
  {
    slug: "behaviour",
    label: "Behavioral",
    concern: "Behaviour problem",
    specialisations: ["behaviour"],
    terms: ["behaviour", "behavior", "anxiety", "aggress", "training"],
    anyVet: false,
  },
];

export function findCareNeed(slug: string | undefined | null) {
  return CARE_NEEDS.find((need) => need.slug === slug) ?? null;
}
