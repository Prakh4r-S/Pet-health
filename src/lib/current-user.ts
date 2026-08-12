import { redirect } from "next/navigation";
import { auth } from "@/../auth";

/**
 * The signed-in user, or a redirect to the sign-in page.
 *
 * This replaces the hardcoded demo account. Because every page and server
 * action already routed through this one function, swapping the body was
 * the whole migration — the ownership checks written against the demo
 * user became real checks with no changes at the call sites.
 */
export async function getCurrentUser() {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/signin");
  }

  return session.user as {
    id: string;
    name?: string | null;
    email?: string | null;
    image?: string | null;
  };
}

/**
 * Same, but returns null instead of redirecting — for pages that render
 * differently when signed out rather than being closed entirely.
 */
export async function getOptionalUser() {
  const session = await auth();
  return session?.user?.id ? session.user : null;
}
