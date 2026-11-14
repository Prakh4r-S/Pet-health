import { parseCoordinates, type Coordinates } from "@/lib/geo";

/**
 * The practice details a vet can set, read from a submitted form.
 *
 * Shared by onboarding and the profile editor so the two cannot drift:
 * a field accepted at signup is accepted, with the same limits, when it
 * is edited later. Onboarding's form simply leaves most of these out,
 * and a field that is not there reads as empty.
 */
export type VetDetails = {
  licenceNumber: string;
  qualifications: string | null;
  bio: string | null;
  specialties: string[];
  yearsExperience: number | null;
  consultationFee: number | null;
  clinicName: string | null;
  clinicAddress: string | null;
  city: string | null;
  state: string | null;
  postalCode: string | null;
  latitude: number | null;
  longitude: number | null;
};

const MAX_SPECIALTIES = 12;

function text(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

/**
 * "Dogs, cats , Surgery,dogs" -> ["Dogs", "cats", "Surgery"]. Split on
 * commas and new lines, trimmed, and de-duplicated without regard to
 * case, keeping the first spelling.
 */
export function parseSpecialties(raw: string) {
  const seen = new Set<string>();
  const tags: string[] = [];
  for (const part of raw.split(/[,\n]/)) {
    const tag = part.trim().replace(/\s+/g, " ");
    const key = tag.toLowerCase();
    if (!tag || seen.has(key)) continue;
    seen.add(key);
    tags.push(tag);
  }
  return tags;
}

export function parseVetDetails(
  formData: FormData,
): { details: VetDetails } | { error: string } {
  const licenceNumber = text(formData, "licenceNumber");
  const qualifications = text(formData, "qualifications");
  const bio = text(formData, "bio");
  const clinicName = text(formData, "clinicName");
  const clinicAddress = text(formData, "clinicAddress");
  const city = text(formData, "city");
  const state = text(formData, "state");
  const postalCode = text(formData, "postalCode");
  const yearsRaw = text(formData, "yearsExperience");
  const feeRaw = text(formData, "consultationFee");
  const specialties = parseSpecialties(text(formData, "specialties"));

  if (!licenceNumber) return { error: "Licence number is required." };
  if (licenceNumber.length > 60) return { error: "That licence number is too long." };
  if (qualifications.length > 200) return { error: "Keep qualifications under 200 characters." };
  if (bio.length > 2000) return { error: "Keep the bio under 2,000 characters." };
  if (clinicName.length > 120) return { error: "That clinic name is too long." };
  if (clinicAddress.length > 300) return { error: "That address is too long." };
  if (city.length > 80 || state.length > 80) return { error: "That place name is too long." };
  if (postalCode.length > 12) return { error: "That postal code is too long." };

  if (specialties.length > MAX_SPECIALTIES) {
    return { error: `List at most ${MAX_SPECIALTIES} specialties.` };
  }
  if (specialties.some((tag) => tag.length > 40)) {
    return { error: "Keep each specialty under 40 characters." };
  }

  const yearsExperience = yearsRaw ? Number(yearsRaw) : null;
  if (
    yearsExperience !== null &&
    (!Number.isInteger(yearsExperience) || yearsExperience < 0 || yearsExperience > 70)
  ) {
    return { error: "Years of experience should be a whole number between 0 and 70." };
  }

  const consultationFee = feeRaw ? Number(feeRaw) : null;
  if (
    consultationFee !== null &&
    (!Number.isInteger(consultationFee) || consultationFee < 0 || consultationFee > 100_000)
  ) {
    return { error: "Enter the consultation fee in whole rupees." };
  }

  const coordinates: Coordinates | null | false = parseCoordinates(formData);
  if (coordinates === false) {
    return {
      error: "Enter both a latitude (-90 to 90) and a longitude (-180 to 180), or neither.",
    };
  }

  return {
    details: {
      licenceNumber,
      qualifications: qualifications || null,
      bio: bio || null,
      specialties,
      yearsExperience,
      consultationFee,
      clinicName: clinicName || null,
      clinicAddress: clinicAddress || null,
      city: city || null,
      state: state || null,
      postalCode: postalCode || null,
      latitude: coordinates?.latitude ?? null,
      longitude: coordinates?.longitude ?? null,
    },
  };
}
