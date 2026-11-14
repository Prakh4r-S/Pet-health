/** Used when a vet does not choose, and what existing profiles were given. */
export const DEFAULT_TIMEZONE = "Asia/Kolkata";

/**
 * Whether a string names a timezone this runtime can do arithmetic in.
 *
 * Checked by trying to use it rather than against a list: the list the
 * runtime publishes is of canonical names only, and which spelling is
 * canonical ("Asia/Kolkata" or "Asia/Calcutta") depends on its version,
 * while both work everywhere.
 */
export function isValidTimezone(value: string) {
  if (!value || value.length > 64) return false;
  try {
    new Intl.DateTimeFormat("en", { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

/** IANA zone names for a selector, always including the default. */
export function listTimezones(): string[] {
  const zones = new Set<string>(Intl.supportedValuesOf("timeZone"));

  // Offer the modern name for India whichever one the runtime lists.
  zones.delete("Asia/Calcutta");
  zones.add(DEFAULT_TIMEZONE);
  zones.add("UTC");

  return [...zones].sort((a, b) => a.localeCompare(b));
}

/** "2027-01-10" -> "2027-01-11". Pure calendar arithmetic, no zone involved. */
export function nextCalendarDay(date: string) {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10);
}

/** A real calendar date in YYYY-MM-DD form — rejects 2027-02-31. */
export function isCalendarDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}
