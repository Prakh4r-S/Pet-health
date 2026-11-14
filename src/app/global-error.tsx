"use client"; // Error boundaries must be Client Components

import "./globals.css";

/**
 * The last resort: shown when the root layout itself fails.
 *
 * error.tsx cannot catch that, because it renders inside the layout — and
 * the layout's header reads the database, so it can fail like any page.
 * This replaces the whole document, which is why it carries its own
 * <html> and <body> and imports the stylesheet directly.
 */
export default function GlobalError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return (
    <html lang="en">
      <body className="flex min-h-screen flex-col">
        <title>Something went wrong · Max Petcare</title>
        <main className="mx-auto flex max-w-md flex-col px-6 py-24 text-center">
          <p className="text-sm font-medium uppercase tracking-wide text-aqua-600">
            Something went wrong
          </p>
          <h1 className="mt-3 text-3xl text-navy-900">Max Petcare is having trouble</h1>
          <p className="mt-3 text-ink-soft">
            The page couldn&apos;t be loaded. This is usually temporary.
          </p>
          <div className="mt-8">
            <button
              type="button"
              onClick={() => retry()}
              className="rounded-md bg-navy-900 px-4 py-2 text-sm text-white hover:bg-navy-700"
            >
              Try again
            </button>
          </div>
          {error.digest && (
            <p className="mt-8 text-xs text-ink-soft">
              If this keeps happening, quote reference{" "}
              <code className="rounded bg-mist px-1.5 py-0.5">{error.digest}</code>.
            </p>
          )}
        </main>
      </body>
    </html>
  );
}
