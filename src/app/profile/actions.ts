"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/current-user";
import { fail, ok, type ActionState } from "@/lib/action-result";
import { parseImageField } from "@/lib/upload-rules";

function text(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

/**
 * Saves the signed-in user's own profile.
 *
 * Every field is optional and an empty one is stored as null, so clearing
 * a field in the form clears it in the record. There is no user id in the
 * form: the row updated is always the caller's.
 */
export async function updateProfile(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await getCurrentUser();

  const name = text(formData, "name");
  const ageRaw = text(formData, "age");
  const phone = text(formData, "phone");
  const bio = text(formData, "bio");
  const city = text(formData, "city");
  const state = text(formData, "state");
  const postalCode = text(formData, "postalCode");
  const latitudeRaw = text(formData, "latitude");
  const longitudeRaw = text(formData, "longitude");

  if (name.length > 80) return fail("That name is too long.");

  const avatarUrl = parseImageField(formData.get("avatarUrl"));
  if (avatarUrl === false) return fail("That photo could not be used. Upload it again.");

  let age: number | null = null;
  if (ageRaw) {
    age = Number(ageRaw);
    if (!Number.isInteger(age) || age < 1 || age > 120) {
      return fail("Enter your age as a whole number of years.");
    }
  }

  // Loose on purpose: numbers are written with spaces, dashes, brackets
  // and country codes, and nothing here dials them.
  if (phone && !/^\+?[\d\s().-]{6,20}$/.test(phone)) {
    return fail("Enter a valid phone number.");
  }

  if (bio.length > 500) return fail("Keep the bio under 500 characters.");
  if (city.length > 80 || state.length > 80) return fail("That place name is too long.");
  if (postalCode.length > 12) return fail("That postal code is too long.");

  // Coordinates come as a pair or not at all; half a position is no use
  // to anything that measures distance.
  let latitude: number | null = null;
  let longitude: number | null = null;
  if (latitudeRaw || longitudeRaw) {
    latitude = Number(latitudeRaw);
    longitude = Number(longitudeRaw);
    const valid =
      latitudeRaw !== "" &&
      longitudeRaw !== "" &&
      Number.isFinite(latitude) &&
      Number.isFinite(longitude) &&
      Math.abs(latitude) <= 90 &&
      Math.abs(longitude) <= 180;
    if (!valid) return fail("That location could not be read. Try setting it again.");
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      name: name || null,
      avatarUrl,
      age,
      phone: phone || null,
      bio: bio || null,
      city: city || null,
      state: state || null,
      postalCode: postalCode || null,
      latitude,
      longitude,
    },
  });

  revalidatePath("/profile");
  return ok;
}
