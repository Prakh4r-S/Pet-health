import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/current-user";

export const dynamic = "force-dynamic";

/**
 * Sends a newly signed-in person to the right place.
 *
 * This exists because the destination depends on state that is only
 * knowable after authentication: whether this account already has a vet
 * profile. A vet signing in for the tenth time wants their schedule; one
 * signing in for the first time needs onboarding, and neither can be
 * decided before we know who they are.
 *
 * The `as` parameter is a request, not a grant — it decides where to
 * send someone, and every page they land on still checks its own
 * permissions.
 */
export default async function WelcomePage({
  searchParams,
}: {
  searchParams: Promise<{ as?: string }>;
}) {
  const user = await getCurrentUser();
  const { as } = await searchParams;

  const profile = await prisma.vetProfile.findUnique({
    where: { userId: user.id },
    select: { id: true },
  });

  if (profile) redirect("/vet/appointments");
  if (as === "vet") redirect("/vet/onboarding");
  redirect("/pets");
}
