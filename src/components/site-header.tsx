import Image from "next/image";
import Link from "next/link";
import { auth, signOut } from "@/../auth";
import { prisma } from "@/lib/prisma";
import SubmitButton from "@/components/submit-button";

/**
 * Navigation, which differs by role.
 *
 * A vet and an owner want almost nothing in common from a nav bar: one
 * needs their schedule, the other needs their animals. Showing both sets
 * to everyone and greying out the irrelevant half would be worse than
 * showing each person only what applies to them.
 *
 * A vet is also an owner — they may have their own pets — so the vet nav
 * includes the owner links rather than replacing them. The reverse path
 * is offered too: an owner who is not yet a vet gets a link to
 * practitioner setup, since otherwise the only way in is the vet door on
 * the sign-in page, which a signed-in person never sees.
 *
 * Signed-out visitors get the landing page's section links instead.
 */
export default async function SiteHeader() {
  const session = await auth();

  const isVet = session?.user?.id
    ? (await prisma.vetProfile.count({ where: { userId: session.user.id } })) > 0
    : false;

  return (
    <header className="border-b border-mist">
      {/* Wraps rather than overflows: a vet's nav has seven items, which
          do not fit beside the logo on a phone. */}
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-x-6 gap-y-2 px-6 py-4">
        <Link
          href="/"
          className="flex items-center gap-2 whitespace-nowrap font-display text-lg font-semibold text-navy-900"
        >
          {/* The drawing from the logo, without its wordmark: at this size
              the lettering would be unreadable, so the name is set as
              text beside it. Decorative here — the link is named by that
              text. */}
          <Image src="/logo-mark.png" alt="" width={36} height={36} priority />
          Max Petcare
        </Link>

        {session?.user ? (
          <nav className="flex flex-wrap items-center gap-x-5 gap-y-1 text-sm">
            {isVet && (
              <>
                <Link href="/vet/appointments" className="hover:text-navy-700">
                  Schedule
                </Link>
                <Link href="/vet/availability" className="hover:text-navy-700">
                  Availability
                </Link>
                <span className="hidden h-4 w-px bg-mist sm:block" />
              </>
            )}
            <Link href="/pets" className="hover:text-navy-700">
              Pets
            </Link>
            <Link href="/appointments" className="hover:text-navy-700">
              Appointments
            </Link>
            <Link href="/assistant" className="hover:text-navy-700">
              Ask
            </Link>
            <Link href="/profile" className="hover:text-navy-700">
              Profile
            </Link>
            {!isVet && (
              <Link href="/vet/onboarding" className="whitespace-nowrap text-ink-soft hover:text-navy-700">
                Become a vet
              </Link>
            )}
            <form
              action={async () => {
                "use server";
                await signOut({ redirectTo: "/" });
              }}
            >
              <SubmitButton
                pendingLabel="Signing out..."
                className="whitespace-nowrap text-ink-soft hover:text-ink"
              >
                Sign out
              </SubmitButton>
            </form>
          </nav>
        ) : (
          <nav className="flex flex-wrap items-center gap-x-5 gap-y-1 text-sm">
            <Link href="/#how-it-works" className="hidden hover:text-navy-700 sm:inline">
              How it works
            </Link>
            <Link href="/#for-vets" className="hidden hover:text-navy-700 sm:inline">
              For veterinarians
            </Link>
            <Link
              href="/signin"
              className="rounded-md bg-navy-900 px-4 py-2 text-white hover:bg-navy-700"
            >
              Sign in
            </Link>
          </nav>
        )}
      </div>
    </header>
  );
}
