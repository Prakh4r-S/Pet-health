"use client";

import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

const empty =
  "rounded-md border border-dashed border-mist-deep p-6 text-center text-sm text-ink-soft";

/**
 * Open times for one vet, grouped by day, one of which can be picked.
 *
 * Slots arrive as ISO strings: a Date cannot cross the server/client
 * boundary intact, and the string is unambiguous about the instant.
 * Shared by booking and rescheduling, which differ in what they do with
 * the choice but not in how it is made.
 */
export default function SlotGrid({
  slots,
  selected,
  onSelect,
}: {
  slots: string[];
  selected: string | null;
  onSelect: (iso: string) => void;
}) {
  // False on the server and during hydration, true once in the browser.
  // The times below are grouped and labelled in the viewer's timezone,
  // which the server does not know: rendering them there would group
  // slots under UTC days and then disagree with the browser on hydration.
  const inBrowser = useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );

  if (slots.length === 0) {
    return <p className={empty}>No times available in the next two weeks.</p>;
  }
  if (!inBrowser) return <p className={empty}>Loading available times...</p>;

  // Group by calendar day *in the viewer's own timezone* — the vet's
  // hours were converted to instants server-side, so the browser can
  // render them in whatever zone the user is actually in.
  const byDay = new Map<string, string[]>();
  for (const iso of slots) {
    const key = new Date(iso).toLocaleDateString(undefined, {
      weekday: "short",
      day: "numeric",
      month: "short",
    });
    byDay.set(key, [...(byDay.get(key) ?? []), iso]);
  }

  return (
    <div className="max-h-80 overflow-y-auto pr-1">
      {[...byDay.entries()].map(([day, times]) => (
        <div key={day} className="mb-4">
          <p className="mb-2 text-xs font-medium text-ink-soft">{day}</p>
          <div className="flex flex-wrap gap-2">
            {times.map((iso) => (
              <button
                key={iso}
                type="button"
                aria-pressed={selected === iso}
                onClick={() => onSelect(iso)}
                className={`rounded-md px-3 py-1.5 text-sm ${
                  selected === iso ? "bg-navy-900 text-white" : "bg-mist hover:bg-aqua-100"
                }`}
              >
                {new Date(iso).toLocaleTimeString(undefined, {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

/** "Mon, 09:30" — for the label of the button that confirms a choice. */
export function slotLabel(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}
