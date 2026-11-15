"use client";

import { useSyncExternalStore } from "react";

const FORMATS = {
  /** "Mon 14 Sep, 09:30" */
  datetime: { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" },
  /** "14 Sep, 09:30" */
  dayTime: { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" },
  /** "14 Sep" */
  day: { day: "numeric", month: "short" },
  /** "09:30" */
  time: { hour: "2-digit", minute: "2-digit" },
} satisfies Record<string, Intl.DateTimeFormatOptions>;

const subscribe = () => () => {};

/**
 * Renders an instant in the viewer's own timezone.
 *
 * A server component cannot do this: it formats with the server's zone,
 * which in production is UTC, so a 14:00 appointment in Kolkata is shown
 * as 08:30 to the person who booked it. Only the browser knows where the
 * viewer is.
 *
 * The server pass therefore renders the time in UTC and says so — correct
 * but unfriendly, and what anyone without JavaScript keeps. On hydration
 * the browser swaps in local time. useSyncExternalStore is what makes
 * that swap legitimate: it is the supported way to render one value on
 * the server and another on the client without a hydration mismatch.
 */
export default function LocalTime({
  date,
  format = "datetime",
}: {
  /** ISO string — a Date does not cross the server/client boundary intact. */
  date: string;
  format?: keyof typeof FORMATS;
}) {
  const instant = new Date(date);

  const text = useSyncExternalStore(
    subscribe,
    () => instant.toLocaleString(undefined, FORMATS[format]),
    () =>
      `${instant.toLocaleString("en-GB", { ...FORMATS[format], timeZone: "UTC" })} UTC`,
  );

  return <time dateTime={date}>{text}</time>;
}
