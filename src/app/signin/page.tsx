import { redirect } from "next/navigation";
import { auth, signIn } from "@/../auth";

export default async function SignInPage() {
  const session = await auth();
  if (session?.user) redirect("/pets");

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-6">
      <h1 className="text-2xl font-semibold">Sign in</h1>
      <p className="mt-2 mb-8 text-sm text-gray-600">
        Keep your pets&apos; health records in one place.
      </p>

      <form
        action={async () => {
          "use server";
          await signIn("google", { redirectTo: "/pets" });
        }}
      >
        <button
          type="submit"
          className="w-full rounded-md border border-gray-300 px-4 py-2.5 text-sm font-medium hover:bg-gray-50"
        >
          Continue with Google
        </button>
      </form>
    </main>
  );
}
