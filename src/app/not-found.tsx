import Link from "next/link";

export const metadata = { title: "Not found · Max Petcare" };

/**
 * Shown for a URL that matches nothing, and for records that exist but
 * are not this person's to see. The two are deliberately
 * indistinguishable — telling a stranger "that pet exists, but isn't
 * yours" confirms more than they need to know — so the wording here
 * covers both without saying which.
 */
export default function NotFound() {
  return (
    <main className="mx-auto flex max-w-md flex-col px-6 py-24 text-center">
      <p className="text-sm font-medium uppercase tracking-wide text-pine-500">Not found</p>
      <h1 className="mt-3 text-3xl text-pine-900">There&apos;s nothing here</h1>
      <p className="mt-3 text-bark-soft">
        The page may have moved, or the record isn&apos;t one you have access to.
      </p>

      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        <Link
          href="/pets"
          className="rounded-md bg-pine-900 px-4 py-2 text-sm text-white hover:bg-pine-700"
        >
          Your pets
        </Link>
        <Link
          href="/appointments"
          className="rounded-md border border-mist px-4 py-2 text-sm text-pine-900 hover:bg-pine-50"
        >
          Appointments
        </Link>
      </div>
    </main>
  );
}
