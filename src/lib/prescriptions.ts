/**
 * When a prescription counts as current. Shared by the public passport,
 * the owner's care summary and the dose log, so that the three never
 * disagree about what an animal is "on".
 */

const DAY_MS = 86_400_000;

/**
 * A prescription with no stated duration is treated as current for this
 * long after it was written. Without a cut-off, a one-off course whose
 * length the vet never recorded would be listed as "current medication"
 * for the rest of the animal's life.
 */
export const OPEN_ENDED_PRESCRIPTION_DAYS = 90;

/** The day a course ends, or null when the vet gave no duration. */
export function prescriptionEnd(p: { createdAt: Date; durationDays: number | null }) {
  return p.durationDays != null
    ? new Date(p.createdAt.getTime() + p.durationDays * DAY_MS)
    : null;
}

export function isPrescriptionCurrent(
  p: { createdAt: Date; durationDays: number | null },
  now: Date = new Date(),
) {
  const until = prescriptionEnd(p);
  return until
    ? until.getTime() >= now.getTime()
    : now.getTime() - p.createdAt.getTime() <= OPEN_ENDED_PRESCRIPTION_DAYS * DAY_MS;
}

/**
 * How many doses a day a frequency asks for, when it says so plainly.
 *
 * Frequency is free text because vets write it many ways, and most of
 * those ways cannot be turned into a number ("as needed", "with each
 * meal"). The common ones can. Null means "could not tell" — the caller
 * then shows the count of doses given without a target, rather than a
 * target that was guessed.
 */
export function dosesPerDay(frequency: string): number | null {
  const text = frequency.toLowerCase();

  if (/\b(as needed|when needed|prn|if required)\b/.test(text)) return null;

  const everyHours = /every\s+(\d{1,2})\s*(h|hr|hrs|hour|hours)\b/.exec(text);
  if (everyHours) {
    const hours = Number(everyHours[1]);
    return hours >= 1 && hours <= 24 ? Math.round(24 / hours) : null;
  }

  const times = /(\d)\s*(x|times)\s*(a|per|\/)?\s*(day|daily)/.exec(text);
  if (times) return Number(times[1]);

  if (/\b(four times|qid)\b/.test(text)) return 4;
  if (/\b(three times|thrice|tid)\b/.test(text)) return 3;
  if (/\b(twice|two times|bid)\b/.test(text)) return 2;
  if (/\b(once|one time|sid)\b/.test(text) && /\b(day|daily)\b/.test(text)) return 1;
  if (/\b(daily|every day|each day|once a day)\b/.test(text)) return 1;

  return null;
}
