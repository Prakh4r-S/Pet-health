"use client";

import { useId, useState } from "react";
import {
  DURATION_LABELS,
  SYMPTOM_DURATIONS,
  URGENCY_HINTS,
  URGENCY_LABELS,
  VISIT_URGENCIES,
  type VisitUrgency,
} from "@/lib/visit-intake";

export type IntakePet = { id: string; name: string; species?: string | null };

const field =
  "w-full rounded-md border border-mist-deep bg-white px-3 py-2 text-sm placeholder:text-ink-faint";
const legend = "mb-2 block text-sm font-medium text-ink";

/** A row of radio buttons drawn as pills. Native radios underneath, so
 *  the group is keyboard-navigable and submits with the form. */
function PillGroup<T extends string>({
  name,
  options,
  labels,
  value,
  onChange,
  required,
  tone,
}: {
  name: string;
  options: readonly T[];
  labels: Record<T, string>;
  value: T | null;
  onChange: (v: T) => void;
  required?: boolean;
  tone?: (v: T) => string;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => {
        const checked = value === o;
        return (
          <label
            key={o}
            className={`cursor-pointer rounded-full border px-3 py-1.5 text-sm transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-aqua-600 ${
              checked
                ? (tone?.(o) ?? "border-navy-900 bg-navy-900 text-white")
                : "border-mist-deep bg-white text-ink hover:bg-aqua-50"
            }`}
          >
            <input
              type="radio"
              name={name}
              value={o}
              checked={checked}
              onChange={() => onChange(o)}
              required={required}
              className="sr-only"
            />
            {labels[o]}
          </label>
        );
      })}
    </div>
  );
}

const urgencyTone: Record<VisitUrgency, string> = {
  ROUTINE: "border-navy-900 bg-navy-900 text-white",
  SOON: "border-amber-600 bg-amber-600 text-white",
  URGENT: "border-red-700 bg-red-700 text-white",
};

/**
 * The owner's pre-visit brief, as form fields: which pet, what is wrong,
 * for how long, and optionally how pressing it is and anything else.
 *
 * Rendered inside a booking form and submitted with it; the server
 * re-validates everything (see lib/visit-intake).
 */
export default function IntakeFields({
  pets,
  compact = false,
}: {
  pets: IntakePet[];
  /** Tighter spacing, for the instant-match panel. */
  compact?: boolean;
}) {
  const id = useId();
  const [petId, setPetId] = useState(pets[0]?.id ?? "");
  const [duration, setDuration] = useState<(typeof SYMPTOM_DURATIONS)[number] | null>(null);
  const [urgency, setUrgency] = useState<VisitUrgency | null>(null);

  const gap = compact ? "gap-4" : "gap-5";

  return (
    <div className={`grid ${gap}`}>
      <fieldset>
        <legend className={legend}>Who is the visit for?</legend>
        {pets.length === 1 ? (
          <>
            <input type="hidden" name="petId" value={pets[0].id} />
            <p className="text-sm text-ink">
              {pets[0].name}
              {pets[0].species && <span className="text-ink-soft"> · {pets[0].species}</span>}
            </p>
          </>
        ) : (
          <div className="flex flex-wrap gap-2">
            {pets.map((p) => {
              const checked = petId === p.id;
              return (
                <label
                  key={p.id}
                  className={`cursor-pointer rounded-lg border px-3 py-2 text-sm has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-aqua-600 ${
                    checked
                      ? "border-navy-900 bg-aqua-50 text-navy-900 ring-1 ring-navy-900"
                      : "border-mist-deep bg-white hover:bg-aqua-50"
                  }`}
                >
                  <input
                    type="radio"
                    name="petId"
                    value={p.id}
                    checked={checked}
                    onChange={() => setPetId(p.id)}
                    required
                    className="sr-only"
                  />
                  <span className="font-medium">{p.name}</span>
                  {p.species && <span className="ml-1 text-ink-soft">· {p.species}</span>}
                </label>
              );
            })}
          </div>
        )}
      </fieldset>

      <div>
        <label className={legend} htmlFor={`${id}-reason`}>
          Primary concern / symptoms
        </label>
        <textarea
          id={`${id}-reason`}
          name="reason"
          rows={compact ? 2 : 3}
          maxLength={500}
          required
          className={field}
          placeholder="e.g. Limping on the back left leg, not putting weight on it"
        />
      </div>

      <fieldset>
        <legend className={legend}>How long has this been going on?</legend>
        <PillGroup
          name="symptomDuration"
          options={SYMPTOM_DURATIONS}
          labels={DURATION_LABELS}
          value={duration}
          onChange={setDuration}
          required
        />
      </fieldset>

      <fieldset>
        <legend className={legend}>
          Urgency <span className="font-normal text-ink-faint">(optional)</span>
        </legend>
        <PillGroup
          name="urgency"
          options={VISIT_URGENCIES}
          labels={URGENCY_LABELS}
          value={urgency}
          onChange={setUrgency}
          tone={(v) => urgencyTone[v]}
        />
        {urgency && <p className="mt-2 text-xs text-ink-soft">{URGENCY_HINTS[urgency]}</p>}
        {urgency === "URGENT" && (
          <p className="mt-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-900">
            If your pet is struggling to breathe, collapsed, bleeding heavily or
            has eaten something poisonous, go to an emergency clinic now — don&apos;t
            wait for a video call.
          </p>
        )}
      </fieldset>

      <div>
        <label className={legend} htmlFor={`${id}-notes`}>
          Anything else the vet should know?{" "}
          <span className="font-normal text-ink-faint">(optional)</span>
        </label>
        <textarea
          id={`${id}-notes`}
          name="intakeNotes"
          rows={2}
          maxLength={1000}
          className={field}
          placeholder="Eating less since Tuesday, had a similar problem last year, on joint supplements…"
        />
      </div>
    </div>
  );
}
