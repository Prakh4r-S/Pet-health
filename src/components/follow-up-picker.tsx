"use client";

import { useState } from "react";

const QUICK_PICKS = [
  { label: "3 days", days: 3 },
  { label: "1 week", days: 7 },
  { label: "2 weeks", days: 14 },
  { label: "1 month", days: 30 },
];

/** yyyy-mm-dd for a day `days` from today, in the vet's own calendar. */
function daysFromToday(days: number) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/**
 * The follow-up date, with one-tap intervals for the common cases. A
 * plain date input underneath, so it posts with the review form like
 * any other field.
 */
export default function FollowUpPicker({
  id,
  defaultValue,
}: {
  id: string;
  defaultValue: string | null;
}) {
  const [value, setValue] = useState(defaultValue ?? "");

  return (
    <div className="flex flex-wrap items-center gap-2">
      <input
        id={id}
        name="followUpOn"
        type="date"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="w-44 rounded-md border border-mist-deep px-3 py-2 text-sm"
      />
      {QUICK_PICKS.map((p) => {
        const date = daysFromToday(p.days);
        return (
          <button
            key={p.label}
            type="button"
            onClick={() => setValue(date)}
            aria-pressed={value === date}
            className={`rounded-full border px-3 py-1 text-xs ${
              value === date
                ? "border-navy-900 bg-navy-900 text-white"
                : "border-mist-deep bg-white text-ink hover:bg-aqua-50"
            }`}
          >
            {p.label}
          </button>
        );
      })}
      {value && (
        <button
          type="button"
          onClick={() => setValue("")}
          className="text-xs text-ink-soft hover:underline"
        >
          No follow-up
        </button>
      )}
    </div>
  );
}
