"use client";

import { useState } from "react";
import { bookInstantMatch } from "@/app/appointments/actions";
import ActionForm from "@/components/action-form";
import SubmitButton from "@/components/submit-button";
import IntakeFields, { type IntakePet } from "@/components/intake-fields";



export default function InstantMatch({
  pets,
  specialisationSlug,
  availableCount,
  defaultConcern,
}: {
  pets: IntakePet[];
  defaultConcern?: string;
  specialisationSlug?: string;
  availableCount: number;
}) {
  const [open, setOpen] = useState(false);

  if (pets.length === 0) return null;

  if (availableCount === 0) {
    return (
      <div className="mb-6 rounded-lg border border-mist bg-aqua-50 p-4 text-sm text-ink-soft">
        No vets have an opening in the next 24 hours. Pick a later time below instead.
      </div>
    );
  }

  return (
    <div className="mb-6 rounded-lg border border-aqua-100 bg-aqua-50 p-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-navy-900">
            {availableCount} {availableCount === 1 ? "vet has" : "vets have"} an opening in the
            next 24 hours
          </p>
          <p className="text-xs text-navy-900">
            We&apos;ll book you the earliest open slot with any of them. It may
            not be immediate — you&apos;ll see the time once it&apos;s booked.
          </p>
        </div>
        {!open && (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="shrink-0 rounded-md bg-navy-900 px-4 py-2 text-sm text-white hover:bg-navy-700"
          >
            Book the earliest slot
          </button>
        )}
      </div>

      {open && (
        <ActionForm action={bookInstantMatch} className="mt-4 grid gap-3">
          {specialisationSlug && (
            <input type="hidden" name="specialisationSlug" value={specialisationSlug} />
          )}
          <div className="rounded-md border border-aqua-100 bg-white p-4">
            <IntakeFields pets={pets} compact defaultConcern={defaultConcern} />
          </div>
          <div className="flex items-center gap-3">
            <SubmitButton pendingLabel="Booking...">Book the earliest slot</SubmitButton>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-sm text-ink-soft hover:underline"
            >
              Not now
            </button>
          </div>
        </ActionForm>
      )}
    </div>
  );
}
