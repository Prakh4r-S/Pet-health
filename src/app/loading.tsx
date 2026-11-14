/**
 * Shown while a page's data is being fetched.
 *
 * Every page here reads the session and the database before it can
 * render, so without this a click appears to do nothing until the server
 * answers. The shape is a generic heading-and-cards outline rather than a
 * copy of any one page: it has to stand in for all of them.
 */
export default function Loading() {
  return (
    <main
      className="mx-auto max-w-2xl px-6 py-10"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <span className="sr-only">Loading</span>

      <div className="animate-pulse" aria-hidden="true">
        <div className="mb-8 flex items-center justify-between">
          <div className="h-8 w-48 rounded-md bg-pine-100" />
          <div className="h-9 w-24 rounded-md bg-mist" />
        </div>

        <div className="grid gap-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="rounded-lg border border-mist p-4">
              <div className="h-4 w-40 rounded bg-mist" />
              <div className="mt-3 h-3 w-64 max-w-full rounded bg-pine-50" />
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
