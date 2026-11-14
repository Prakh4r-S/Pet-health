import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/../auth";
import { prisma } from "@/lib/prisma";
import { RETURN_TO_HEADER, signInUrl } from "@/lib/return-to";

/**
 * The signed-in user, or a redirect to sign-in.
 *
 * The redirect carries the path that was being requested, so that
 * following a link to an appointment while signed out ends at that
 * appointment rather than at a generic start page.
 */
export async function getCurrentUser() {
  const session = await auth();
  if (!session?.user?.id) {
    const requested = (await headers()).get(RETURN_TO_HEADER);
    redirect(signInUrl(requested));
  }
  return session.user as {
    id: string;
    role: "OWNER" | "VET";
    name?: string | null;
    email?: string | null;
    image?: string | null;
  };
}

/** Returns null instead of redirecting, for pages that render both ways. */
export async function getOptionalUser() {
  const session = await auth();
  return session?.user?.id ? session.user : null;
}

/**
 * The signed-in user's vet profile, or a redirect to onboarding.
 *
 * The profile is read from the database rather than trusted from the
 * session. With database sessions the two rarely diverge, but a role
 * change should take effect on the next request rather than whenever
 * the session happens to expire — and an authorisation check is the
 * wrong place to economise on a query.
 */
export async function requireVetProfile() {
  const user = await getCurrentUser();

  const profile = await prisma.vetProfile.findUnique({
    where: { userId: user.id },
    include: { specialisations: true },
  });

  if (!profile) redirect("/vet/onboarding");
  return { user, profile };
}