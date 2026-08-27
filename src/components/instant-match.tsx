"use client";

import { useState } from "react";
import { bookInstantMatch } from "@/app/appointments/actions";

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
      <div className="mb-6 rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm text-gray-600">
        No vets are free right now. Pick a time below instead.
      </div>
    );
  }

  return (
    <div className="mb-6 rounded-lg border border-green-200 bg-green-50 p-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-green-900">
            {availableCount} {availableCount === 1 ? "vet is" : "vets are"} free now
          </p>
          <p className="text-xs text-green-800">
            We&apos;ll match you with whoever can see you soonest.
          </p>
        </div>
        {!open && (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="shrink-0 rounded-md bg-green-700 px-4 py-2 text-sm text-white hover:bg-green-800"
          >
            See a vet now
          </button>
        )}
      </div>

      {open && (
        <form action={bookInstantMatch} className="mt-4 grid gap-3">
          {specialisationSlug && (
            <input type="hidden" name="specialisationSlug" value={specialisationSlug} />
          )}
          <div className="flex flex-wrap items-end gap-3">
            <div className="w-44">
              <label className="mb-1 block text-xs text-green-900" htmlFor="petId">
                Pet
              </label>
              <select
                id="petId"
                name="petId"
                className="w-full rounded-md border border-green-300 bg-white px-3 py-2 text-sm"
                required
              >
                {pets.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
            <div className="min-w-48 flex-1">
              <label className="mb-1 block text-xs text-green-900" htmlFor="reason">
                What&apos;s wrong?
              </label>
              <input
                id="reason"
                name="reason"
                className="w-full rounded-md border border-green-300 bg-white px-3 py-2 text-sm"
                placeholder="Limping since this morning"
              />
            </div>
            <button
              type="submit"
              className="rounded-md bg-green-700 px-4 py-2 text-sm text-white hover:bg-green-800"
            >
              Match me
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
