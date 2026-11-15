/**
 * Builds an iCalendar (.ics) file for one event, per RFC 5545.
 *
 * Small enough to write by hand, and the format is unforgiving in ways
 * a library would also have to be told about: lines end in CRLF, are
 * folded at 75 octets, and commas, semicolons and line breaks inside
 * text have to be escaped. Calendar apps tend to reject a file silently
 * rather than say which of those was wrong.
 */

export type CalendarEvent = {
  /** Stable for the life of the event, so re-importing updates it instead of duplicating. */
  uid: string;
  startsAt: Date;
  endsAt: Date;
  /** When the event was last changed. Lets a calendar tell a reschedule from a copy. */
  updatedAt: Date;
  title: string;
  description: string;
  url: string;
  /** Minutes before the start to remind. */
  reminderMinutes?: number;
};

/** 20261115T093000Z — UTC, so no timezone definition has to be shipped. */
function utcStamp(date: Date) {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

function escapeText(value: string) {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

/**
 * Folds a content line so no line is longer than 75 octets, counting
 * bytes rather than characters and never splitting one character across
 * two lines. Continuation lines start with a space.
 */
function fold(line: string) {
  const encoder = new TextEncoder();
  const parts: string[] = [];
  let current = "";
  let bytes = 0;

  for (const char of line) {
    const size = encoder.encode(char).length;
    // 75 for the first line; continuations lose one to the leading space.
    const limit = parts.length === 0 ? 75 : 74;
    if (bytes + size > limit) {
      parts.push(current);
      current = "";
      bytes = 0;
    }
    current += char;
    bytes += size;
  }
  parts.push(current);
  return parts.join("\r\n ");
}

export function buildCalendarFile(event: CalendarEvent) {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Max Petcare//Appointments//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${event.uid}`,
    `DTSTAMP:${utcStamp(event.updatedAt)}`,
    `LAST-MODIFIED:${utcStamp(event.updatedAt)}`,
    // Seconds since the epoch always rises, which is all SEQUENCE needs.
    `SEQUENCE:${Math.floor(event.updatedAt.getTime() / 1000)}`,
    `DTSTART:${utcStamp(event.startsAt)}`,
    `DTEND:${utcStamp(event.endsAt)}`,
    `SUMMARY:${escapeText(event.title)}`,
    `DESCRIPTION:${escapeText(event.description)}`,
    `LOCATION:${escapeText(event.url)}`,
    `URL:${event.url}`,
    "STATUS:CONFIRMED",
    ...(event.reminderMinutes
      ? [
          "BEGIN:VALARM",
          "ACTION:DISPLAY",
          `DESCRIPTION:${escapeText(event.title)}`,
          `TRIGGER:-PT${event.reminderMinutes}M`,
          "END:VALARM",
        ]
      : []),
    "END:VEVENT",
    "END:VCALENDAR",
  ];

  return lines.map(fold).join("\r\n") + "\r\n";
}
