import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth, signIn } from "@/../auth";
import SubmitButton from "@/components/submit-button";
import { safeReturnTo } from "@/lib/return-to";

export const dynamic = "force-dynamic";

/**
 * One sign-in mechanism, two doors.
 *
 * There is no separate credential store for vets — both roles
 * authenticate with the same Google account, and a vet may well be an
 * owner too. What differs is intent: someone arriving through the vet
 * door is asking to set up a practitioner profile, and is routed to
 * onboarding rather than to their own pets.
 *
 * Where someone lands afterwards is decided in this order: the page they
 * were trying to reach when they were asked to sign in, if there was one;
 * otherwise /welcome, which looks at the account and sends a vet to their
 * schedule and an owner to their pets. Neither can be known here, before
 * anyone has signed in.
 *
 * The intent travels in the redirect URL rather than in a cookie or the
 * session, because it is needed exactly once and only affects where the
 * person lands.
 */
export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ as?: string; callbackUrl?: string }>;
}) {
  const { as, callbackUrl } = await searchParams;
  const asVet = as === "vet";
  const returnTo = safeReturnTo(callbackUrl);

  const destination = returnTo ?? (asVet ? "/welcome?as=vet" : "/welcome");

  // Already signed in: carry on to wherever this visit was headed. For
  // the vet door that is onboarding, via /welcome — an owner who decides
  // to register as a vet should not be bounced back to their pets.
  const session = await auth();
  if (session?.user) redirect(destination);

  return (
    <main className="mx-auto flex max-w-md flex-col justify-center px-6 py-16">
      <Image
        src="/logo.webp"
        alt="Max Petcare"
        width={800}
        height={927}
        priority
        className="mx-auto mb-6 h-auto w-48"
      />
      <h1 className="text-3xl text-navy-900">
        {asVet ? "Sign in as a vet" : "Sign in"}
      </h1>
      <p className="mt-3 text-ink-soft">
        {asVet
          ? "You'll set up a practitioner profile with your licence number and consulting hours."
          : "Your pets' records, appointments and consultations."}
      </p>

      <form
        className="mt-8"
        action={async () => {
          "use server";
          await signIn("google", { redirectTo: destination });
        }}
      >
        <SubmitButton
          pendingLabel="Redirecting to Google..."
          className="w-full rounded-md bg-navy-900 px-4 py-3 text-sm font-medium text-white hover:bg-navy-700"
        >
          Continue with Google
        </SubmitButton>
      </form>

      <p className="mt-6 text-sm text-ink-soft">
        {asVet ? (
          <>
            Looking after your own animals instead?{" "}
            <Link href="/signin" className="text-navy-700 underline">
              Sign in as a pet owner
            </Link>
          </>
        ) : (
          <>
            Are you a vet?{" "}
            <Link href="/signin?as=vet" className="text-navy-700 underline">
              Set up a practitioner account
            </Link>
          </>
        )}
      </p>
    </main>
  );
}
