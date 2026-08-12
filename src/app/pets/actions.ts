"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/current-user";

type Sex = "MALE" | "FEMALE" | "UNKNOWN";

export async function createPet(formData: FormData) {
  const user = await getCurrentUser();

  const name = String(formData.get("name") ?? "").trim();
  const speciesId = String(formData.get("speciesId") ?? "");
  const breedId = String(formData.get("breedId") ?? "") || null;
  const breedFreeText = String(formData.get("breedFreeText") ?? "").trim() || null;
  const sex = (String(formData.get("sex") ?? "UNKNOWN") as Sex) ?? "UNKNOWN";
  const birthDateRaw = String(formData.get("birthDate") ?? "");
  const birthDateIsApprox = formData.get("birthDateIsApprox") === "on";

  // Validate on the server regardless of what the browser enforced.
  // HTML `required` attributes are a convenience, not a guarantee.
  if (!name) throw new Error("Name is required.");
  if (!speciesId) throw new Error("Species is required.");

  await prisma.pet.create({
    data: {
      ownerId: user.id,
      speciesId,
      breedId,
      breedFreeText,
      name,
      sex,
      birthDate: birthDateRaw ? new Date(birthDateRaw) : null,
      birthDateIsApprox,
    },
  });

  revalidatePath("/pets");
  redirect("/pets");
}

