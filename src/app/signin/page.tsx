import Link from "next/link";
import { redirect } from "next/navigation";
import { auth, signIn } from "@/../auth";

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
 * The intent travels in the redirect URL rather than in a cookie or the
 * session, because it is needed exactly once and only affects where the
 * person lands.
 */
export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ as?: string }>;
}) {
  const session = await auth();
  if (session?.user) redirect("/pets");

  const { as } = await searchParams;
  const asVet = as === "vet";

  return (
    <main className="mx-auto flex max-w-md flex-col justify-center px-6 py-24">
      <h1 className="text-3xl text-pine-900">
        {asVet ? "Sign in as a vet" : "Sign in"}
      </h1>
      <p className="mt-3 text-bark-soft">
        {asVet
          ? "You'll set up a practitioner profile with your licence number and consulting hours."
          : "Your pets' records, appointments and consultations."}
      </p>

      <form
        className="mt-8"
        action={async () => {
          "use server";
          await signIn("google", {
            redirectTo: asVet ? "/welcome?as=vet" : "/pets",
          });
        }}
      >
        <button
          type="submit"
          className="w-full rounded-md bg-pine-900 px-4 py-3 text-sm font-medium text-white hover:bg-pine-700"
        >
          Continue with Google
        </button>
      </form>

      <p className="mt-6 text-sm text-bark-soft">
        {asVet ? (
          <>
            Looking after your own animals instead?{" "}
            <Link href="/signin" className="text-pine-700 underline">
              Sign in as a pet owner
            </Link>
          </>
        ) : (
          <>
            Are you a vet?{" "}
            <Link href="/signin?as=vet" className="text-pine-700 underline">
              Set up a practitioner account
            </Link>
          </>
        )}
      </p>
    </main>
  );
}
