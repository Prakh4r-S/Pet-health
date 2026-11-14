"use client"; // Error boundaries must be Client Components

import { useEffect } from "react";
import Link from "next/link";

/**
 * Shown when something unexpected breaks while rendering a page or
 * running an action.
 *
 * Expected problems never reach here — a taken slot or an oversized file
 * is returned by the action and shown next to the form. This is for the
 * rest: the database is unreachable, a bug, a permission check that
 * should not have been reachable. In production the message is stripped
 * before it gets to the browser, so there is nothing useful to print
 * except the digest, which matches the entry in the server logs.
 */
export default function Error({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="mx-auto flex max-w-md flex-col px-6 py-24 text-center">
      <p className="text-sm font-medium uppercase tracking-wide text-aqua-600">
        Something went wrong
      </p>
      <h1 className="mt-3 text-3xl text-navy-900">We couldn&apos;t complete that</h1>
      <p className="mt-3 text-ink-soft">
        That request didn&apos;t go through. It&apos;s usually temporary, and
        trying again often works.
      </p>

      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        <button
          type="button"
          onClick={() => retry()}
          className="rounded-md bg-navy-900 px-4 py-2 text-sm text-white hover:bg-navy-700"
        >
          Try again
        </button>
        <Link
          href="/"
          className="rounded-md border border-mist px-4 py-2 text-sm text-navy-900 hover:bg-aqua-50"
        >
          Go to the start
        </Link>
      </div>

      {error.digest && (
        <p className="mt-8 text-xs text-ink-soft">
          If this keeps happening, quote reference{" "}
          <code className="rounded bg-mist px-1.5 py-0.5">{error.digest}</code>.
        </p>
      )}
    </main>
  );
}
