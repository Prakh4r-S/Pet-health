"use client";

import { useState } from "react";
import { bookInstantMatch } from "@/app/appointments/actions";
import ActionForm from "@/components/action-form";
import SubmitButton from "@/components/submit-button";


type Pet = { id: string; name: string };

export default function InstantMatch({
  pets,
  specialisationSlug,
  availableCount,
}: {
  pets: Pet[];
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
          <div className="flex flex-wrap items-end gap-3">
            <div className="w-44">
              <label className="mb-1 block text-xs text-navy-900" htmlFor="petId">
                Pet
              </label>
              <select
                id="petId"
                name="petId"
                className="w-full rounded-md border border-mist-deep bg-white px-3 py-2 text-sm"
                required
              >
                {pets.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
            <div className="min-w-48 flex-1">
              <label className="mb-1 block text-xs text-navy-900" htmlFor="reason">
                What&apos;s wrong?
              </label>
              <input
                id="reason"
                name="reason"
                className="w-full rounded-md border border-mist-deep bg-white px-3 py-2 text-sm"
                placeholder="Limping since this morning"
              />
            </div>
            <SubmitButton
              pendingLabel="Booking..."
              className="rounded-md bg-navy-900 px-4 py-2 text-sm text-white hover:bg-navy-700"
            >
              Book it
            </SubmitButton>
          </div>
        </ActionForm>
      )}
    </div>
  );
}
