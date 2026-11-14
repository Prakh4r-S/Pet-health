import { prisma } from "@/lib/prisma";
import { getAvailableSlots } from "@/lib/slots";
import { distanceKm, formatDistance, toCoordinates } from "@/lib/geo";

/**
 * Ranks vets for one owner: how near the clinic is, how well the vet
 * suits the owner's animals, and how soon they can be seen.
 *
 * The scoring itself (`scoreVet`) is a pure function of plain values, so
 * it can be reasoned about and tested without a database;
 * `getVetRecommendations` at the bottom is the part that loads those
 * values. Every point awarded comes with a reason the owner can read —
 * a ranking nobody can explain is one nobody should trust with a choice
 * of vet.
 */

// ---------------------------------------------------------------
// Distance
// ---------------------------------------------------------------

/** Great-circle (haversine) distance in kilometres between two points. */
export function calculateDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  return distanceKm(
    { latitude: lat1, longitude: lon1 },
    { latitude: lat2, longitude: lon2 },
  );
}

export type Place = {
  city: string | null;
  state: string | null;
  latitude: number | null;
  longitude: number | null;
};

export type Proximity = {
  /** Null when either side has no coordinates. */
  distanceKm: number | null;
  sameCity: boolean;
  sameState: boolean;
};

const normalise = (value: string | null) => value?.trim().toLowerCase() ?? "";

/**
 * How near a clinic is to an owner. Distance when both have coordinates;
 * the city and state names are compared either way, as the fallback for
 * when they do not. The comparison is by spelling, so "Bengaluru" and
 * "Bangalore" do not match — coordinates are what make this reliable.
 */
export function compareLocations(owner: Place, clinic: Place): Proximity {
  const from = toCoordinates(owner);
  const to = toCoordinates(clinic);
  const city = normalise(owner.city);
  const state = normalise(owner.state);

  return {
    distanceKm:
      from && to
        ? calculateDistanceKm(from.latitude, from.longitude, to.latitude, to.longitude)
        : null,
    sameCity: city !== "" && city === normalise(clinic.city),
    sameState: state !== "" && state === normalise(clinic.state),
  };
}

/** Whether anything is known about where the owner is. */
export function hasLocation(place: Place) {
  return toCoordinates(place) !== null || normalise(place.city) !== "";
}

export const RADIUS_OPTIONS = ["near", "10", "50", "all"] as const;
export type Radius = (typeof RADIUS_OPTIONS)[number];

/** "Near me" in kilometres: roughly, across a city. */
const NEAR_KM = 25;

/**
 * Whether a clinic falls inside the chosen radius. Without a measured
 * distance, being in the owner's city counts as inside — it is the best
 * that names alone can say, and leaving those clinics out would hide
 * every vet who has not set coordinates yet.
 */
export function withinRadius(proximity: Proximity, radius: Radius) {
  if (radius === "all") return true;
  if (proximity.distanceKm === null) return proximity.sameCity;
  return proximity.distanceKm <= (radius === "near" ? NEAR_KM : Number(radius));
}

// ---------------------------------------------------------------
// Pet fit
// ---------------------------------------------------------------

export type MatchPet = {
  name: string;
  species: { name: string; slug: string };
  /** Ongoing conditions only; a resolved one says nothing about today. */
  conditions: string[];
  /** Active allergies: allergen and reaction, as free text. */
  allergies: string[];
};

export type MatchVet = Place & {
  bio: string | null;
  specialties: string[];
  specialisations: { name: string; slug: string }[];
  acceptingNewPatients: boolean;
};

/** Other words a vet might use for a species we know by slug. */
const SPECIES_TERMS: Record<string, string[]> = {
  dog: ["dog", "dogs", "canine", "canines", "puppy", "puppies"],
  cat: ["cat", "cats", "feline", "felines", "kitten", "kittens"],
  bird: ["bird", "birds", "avian"],
  rabbit: ["rabbit", "rabbits"],
};

/** Species an "exotics" vet does not need to say they treat. */
const COMMON_SPECIES = new Set(["dog", "cat"]);

/**
 * Health problems grouped by the kind of vet who deals with them.
 * `signs` are looked for in the pet's conditions and allergies; the
 * topic then matches a vet who holds the specialisation, or who uses one
 * of `terms` in their own specialties or bio.
 */
const TOPICS: { label: string; slug: string; signs: string[]; terms: string[] }[] = [
  {
    label: "Dermatology",
    slug: "dermatology",
    signs: ["skin", "dermat", "itch", "allerg", "mange", "rash", "hot spot", "eczema", "ear infection"],
    terms: ["dermatolog", "skin", "allerg"],
  },
  {
    label: "Orthopaedics",
    slug: "orthopaedics",
    signs: ["arthrit", "hip", "joint", "limp", "fracture", "dysplasia", "ligament", "patella"],
    terms: ["orthop", "joint", "arthrit"],
  },
  {
    label: "Dentistry",
    slug: "dentistry",
    signs: ["dental", "tooth", "teeth", "gingiv", "periodont"],
    terms: ["dent", "teeth"],
  },
  {
    label: "Ophthalmology",
    slug: "ophthalmology",
    signs: ["eye", "cataract", "glaucoma", "conjunctiv"],
    terms: ["ophthalm", "eye"],
  },
  {
    label: "Cardiology",
    slug: "cardiology",
    signs: ["heart", "cardiac", "murmur", "cardio"],
    terms: ["cardio", "heart"],
  },
  {
    label: "Oncology",
    slug: "oncology",
    signs: ["tumour", "tumor", "cancer", "lymphoma", "carcinoma", "mast cell"],
    terms: ["oncolog", "cancer", "tumour", "tumor"],
  },
  {
    label: "Behaviour",
    slug: "behaviour",
    signs: ["anxiety", "anxious", "aggress", "behaviour", "behavior", "phobia"],
    terms: ["behaviour", "behavior", "anxiety"],
  },
  {
    label: "Nutrition",
    slug: "nutrition",
    signs: ["obes", "overweight", "underweight", "diabet", "food allerg", "food intoleran", "diet"],
    terms: ["nutrition", "diet", "weight"],
  },
];

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** A whole word: "cat" must not match "education". */
function hasWord(text: string, word: string) {
  return new RegExp(`(^|[^a-z])${escapeRegExp(word)}([^a-z]|$)`).test(text);
}

/** The start of a word: "dermat" matches "dermatitis", "cardio" not "pericardium". */
function hasStem(text: string, stem: string) {
  return new RegExp(`(^|[^a-z])${escapeRegExp(stem)}`).test(text);
}

function speciesTerms(species: MatchPet["species"]) {
  const name = species.name.toLowerCase();
  return SPECIES_TERMS[species.slug] ?? [name, `${name}s`];
}

/**
 * What about the owner's animals this vet is a particular fit for:
 * the species they say they treat, and the specialities that line up
 * with what the animals have. Labels are what is shown to the owner.
 */
export function findPetFit(pets: MatchPet[], vet: MatchVet) {
  const vetText = [
    ...vet.specialties,
    ...vet.specialisations.map((s) => s.name),
    vet.bio ?? "",
  ]
    .join(" \n ")
    .toLowerCase();
  const treatsExotics =
    vet.specialisations.some((s) => s.slug === "exotics") || hasStem(vetText, "exotic");

  const species = new Map<string, string>();
  for (const pet of pets) {
    if (species.has(pet.species.slug)) continue;
    const named = speciesTerms(pet.species).some((term) => hasWord(vetText, term));
    const viaExotics = treatsExotics && !COMMON_SPECIES.has(pet.species.slug);
    if (named || viaExotics) species.set(pet.species.slug, pet.species.name);
  }

  const petText = pets
    .flatMap((pet) => [...pet.conditions, ...pet.allergies])
    .join(" \n ")
    .toLowerCase();

  const topics = petText
    ? TOPICS.filter(
        (topic) =>
          topic.signs.some((sign) => hasStem(petText, sign)) &&
          (vet.specialisations.some((s) => s.slug === topic.slug) ||
            topic.terms.some((term) => hasStem(vetText, term))),
      ).map((topic) => topic.label)
    : [];

  return { species: [...species.values()], topics };
}

// ---------------------------------------------------------------
// Scoring
// ---------------------------------------------------------------

export type MatchReason = {
  kind: "proximity" | "pet" | "availability";
  label: string;
};

export type VetScore = {
  score: number;
  reasons: MatchReason[];
  proximity: Proximity;
  /** "3.1 km away", or null when there is no measured distance. */
  distanceLabel: string | null;
};

/**
 * The weights. Proximity and pet fit can each outweigh availability:
 * a vet who is free today but two states away, or who does not treat
 * the animal, is not the better recommendation.
 */
const POINTS = {
  within5Km: 40,
  within25Km: 30,
  within100Km: 12,
  sameCity: 28, // no distance to go on, so just under "within 25 km"
  sameState: 8,
  firstSpecies: 15,
  furtherSpecies: 5,
  topic: 15,
  maxPetFit: 45,
  accepting: 5,
  slotsWithin24h: 20,
  slotsWithin48h: 12,
} as const;

const HOUR_MS = 3_600_000;

export function scoreVet(input: {
  owner: Place;
  pets: MatchPet[];
  vet: MatchVet;
  /** The soonest open slot in the next 48 hours, if there is one. */
  nextSlotAt: Date | null;
  now?: Date;
}): VetScore {
  const { owner, pets, vet, nextSlotAt, now = new Date() } = input;
  const reasons: MatchReason[] = [];
  let score = 0;

  // Proximity
  const proximity = compareLocations(owner, vet);
  const km = proximity.distanceKm;
  // As typed by the vet, less any stray spaces.
  const city = vet.city?.trim() || null;
  const state = vet.state?.trim() || null;
  let distanceLabel: string | null = null;

  if (km !== null) {
    distanceLabel = `${formatDistance(km)} away`;
    if (km < 5) score += POINTS.within5Km;
    else if (km < 25) score += POINTS.within25Km;
    else if (km < 100) score += POINTS.within100Km;
    // Only worth giving as a reason when it is in the clinic's favour.
    if (km < 100) {
      reasons.push({
        kind: "proximity",
        label: city ? `${distanceLabel} in ${city}` : distanceLabel,
      });
    }
  } else if (proximity.sameCity) {
    score += POINTS.sameCity;
    reasons.push({ kind: "proximity", label: `In ${city}, your city` });
  } else if (proximity.sameState) {
    score += POINTS.sameState;
    reasons.push({ kind: "proximity", label: `Also in ${state}` });
  }

  // Pet fit
  const fit = findPetFit(pets, vet);
  if (fit.species.length > 0 || fit.topics.length > 0) {
    const points =
      (fit.species.length > 0
        ? POINTS.firstSpecies + (fit.species.length - 1) * POINTS.furtherSpecies
        : 0) +
      fit.topics.length * POINTS.topic;
    score += Math.min(points, POINTS.maxPetFit);
    reasons.push({
      kind: "pet",
      label: `Matches ${[...fit.species, ...fit.topics].slice(0, 3).join(" & ")}`,
    });
  }

  // Availability
  if (vet.acceptingNewPatients) {
    score += POINTS.accepting;
    if (nextSlotAt) {
      const hours = (nextSlotAt.getTime() - now.getTime()) / HOUR_MS;
      // Hours rather than "today": the server does not know which day
      // it is where the owner is.
      if (hours <= 24) {
        score += POINTS.slotsWithin24h;
        reasons.push({ kind: "availability", label: "Slots open in the next 24 hours" });
      } else if (hours <= 48) {
        score += POINTS.slotsWithin48h;
        reasons.push({ kind: "availability", label: "Slots open in the next 48 hours" });
      }
    }
  }

  return { score, reasons, proximity, distanceLabel };
}

/** Best first; the nearer clinic, then the more experienced vet, breaks a tie. */
export function compareMatches(
  a: { match: VetScore; yearsExperience: number | null },
  b: { match: VetScore; yearsExperience: number | null },
) {
  return (
    b.match.score - a.match.score ||
    (a.match.proximity.distanceKm ?? Infinity) - (b.match.proximity.distanceKm ?? Infinity) ||
    (b.yearsExperience ?? 0) - (a.yearsExperience ?? 0)
  );
}

// ---------------------------------------------------------------
// Loading
// ---------------------------------------------------------------

/** Exactly what a vet card shows. The licence number, for one, is not selected. */
const vetCardSelect = {
  id: true,
  avatarUrl: true,
  qualifications: true,
  bio: true,
  specialties: true,
  yearsExperience: true,
  consultationFee: true,
  clinicName: true,
  clinicImageUrl: true,
  city: true,
  state: true,
  latitude: true,
  longitude: true,
  acceptingNewPatients: true,
  user: { select: { name: true, avatarUrl: true, image: true } },
  specialisations: { orderBy: { name: "asc" }, select: { name: true, slug: true } },
} as const;

export type VetRecommendations = Awaited<ReturnType<typeof getVetRecommendations>>;
export type RecommendedVet = VetRecommendations["vets"][number];

/**
 * Bookable vets, ranked for this owner.
 *
 * `petId` narrows pet fit to one animal; anything that is not one of the
 * owner's own pets is ignored rather than trusted. `radius` is ignored
 * when nothing is known about where the owner is — there is nothing to
 * measure from.
 */
export async function getVetRecommendations(
  userId: string,
  options: {
    petId?: string;
    radius?: Radius;
    specialisationSlug?: string;
    limit?: number;
  } = {},
) {
  const { petId, radius = "all", specialisationSlug, limit } = options;

  const [owner, ownerPets, vets] = await Promise.all([
    prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { city: true, state: true, latitude: true, longitude: true },
    }),
    prisma.pet.findMany({
      where: { ownerId: userId, archivedAt: null },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        species: { select: { name: true, slug: true } },
        conditions: { where: { resolvedOn: null }, select: { name: true, notes: true } },
        allergies: { where: { active: true }, select: { allergen: true, reaction: true } },
      },
    }),
    prisma.vetProfile.findMany({
      where: {
        verifiedAt: { not: null },
        acceptingNewPatients: true,
        ...(specialisationSlug
          ? { specialisations: { some: { slug: specialisationSlug } } }
          : {}),
      },
      select: vetCardSelect,
    }),
  ]);

  const selectedPet = ownerPets.find((pet) => pet.id === petId) ?? null;
  const pets: MatchPet[] = (selectedPet ? [selectedPet] : ownerPets).map((pet) => ({
    name: pet.name,
    species: pet.species,
    conditions: pet.conditions.map((c) => [c.name, c.notes].filter(Boolean).join(" ")),
    // The word itself is added so that any allergy counts as one, even
    // when the entry is only the name of a food.
    allergies: pet.allergies.map((a) =>
      ["allergy", a.allergen, a.reaction].filter(Boolean).join(" "),
    ),
  }));

  const ownerHasLocation = hasLocation(owner);
  const appliedRadius: Radius = ownerHasLocation ? radius : "all";
  const now = new Date();

  const scored = await Promise.all(
    vets.map(async (vet) => {
      // Two days of slots, then cut to 48 hours exactly: "two days" as
      // the slot generator counts them runs to the end of a third date.
      const slots = await getAvailableSlots(vet.id, { days: 2 });
      const nextSlotAt =
        slots.find((s) => s.startsAt.getTime() - now.getTime() <= 48 * HOUR_MS)?.startsAt ??
        null;

      return { ...vet, match: scoreVet({ owner, pets, vet, nextSlotAt, now }) };
    }),
  );

  const ranked = scored
    .filter((vet) => withinRadius(vet.match.proximity, appliedRadius))
    .sort(compareMatches);

  return {
    vets: limit ? ranked.slice(0, limit) : ranked,
    ownerHasLocation,
    /** Coordinates, not just a city name: what real distances need. */
    ownerHasCoordinates: toCoordinates(owner) !== null,
    pets: ownerPets.map((pet) => ({ id: pet.id, name: pet.name, species: pet.species.name })),
    selectedPetId: selectedPet?.id ?? null,
    radius: appliedRadius,
  };
}
