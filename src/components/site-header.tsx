import Link from "next/link";
import { auth, signOut } from "@/../auth";
import { prisma } from "@/lib/prisma";

/**
 * Navigation, which differs by role.
 *
 * A vet and an owner want almost nothing in common from a nav bar: one
 * needs their schedule, the other needs their animals. Showing both sets
 * to everyone and greying out the irrelevant half would be worse than
 * showing each person only what applies to them.
 *
 * A vet is also an owner — they may have their own pets — so the vet nav
 * includes the owner links rather than replacing them.
 */
export default async function SiteHeader() {
  const session = await auth();

  const isVet = session?.user?.id
    ? (await prisma.vetProfile.count({ where: { userId: session.user.id } })) > 0
    : false;

  return (
    <header className="border-b border-mist">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-6 px-6 py-4">
        <Link href="/" className="font-display text-lg text-pine-900">
          Pet Health
        </Link>

        {session?.user ? (
          <nav className="flex items-center gap-5 text-sm">
            {isVet && (
              <>
                <Link href="/vet/appointments" className="hover:text-pine-700">
                  Schedule
                </Link>
                <Link href="/vet/availability" className="hover:text-pine-700">
                  Availability
                </Link>
                <span className="h-4 w-px bg-mist" />
              </>
            )}
            <Link href="/pets" className="hover:text-pine-700">
              Pets
            </Link>
            <Link href="/appointments" className="hover:text-pine-700">
              Appointments
            </Link>
            <Link href="/assistant" className="hover:text-pine-700">
              Ask
            </Link>
            <form
              action={async () => {
                "use server";
                await signOut({ redirectTo: "/" });
              }}
            >
              <button type="submit" className="text-bark-soft hover:text-bark">
                Sign out
              </button>
            </form>
          </nav>
        ) : (
          <Link
            href="/signin"
            className="rounded-md bg-pine-900 px-4 py-2 text-sm text-white hover:bg-pine-700"
          >
            Sign in
          </Link>
        )}
      </div>
    </header>
  );
}
