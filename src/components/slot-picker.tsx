"use client";

import { useState } from "react";
import { bookAppointment } from "@/app/appointments/actions";

type Pet = { id: string; name: string };
// Slots arrive as ISO strings: a Date cannot cross the server/client
// boundary intact, and the string is unambiguous about the instant.
type Props = { vetProfileId: string; pets: Pet[]; slots: string[] };

const field = "w-full rounded-md border border-gray-300 px-3 py-2 text-sm";

export default function SlotPicker({ vetProfileId, pets, slots }: Props) {
  const [selected, setSelected] = useState<string | null>(null);

  if (pets.length === 0) {
    return (
      <p className="rounded-md border border-dashed border-gray-300 p-6 text-center text-sm text-gray-500">
        Add a pet before booking.
      </p>
    );
  }

  // Group by calendar day *in the viewer's own timezone* — the vet's
  // hours were converted to instants server-side, so the browser can
  // render them in whatever zone the user is actually in.
  const byDay = new Map<string, string[]>();
  for (const iso of slots) {
    const d = new Date(iso);
    const key = d.toLocaleDateString(undefined, {
      weekday: "short",
      day: "numeric",
      month: "short",
    });
    byDay.set(key, [...(byDay.get(key) ?? []), iso]);
  }

  if (slots.length === 0) {
    return (
      <p className="rounded-md border border-dashed border-gray-300 p-6 text-center text-sm text-gray-500">
        No times available in the next two weeks.
      </p>
    );
  }

  return (
    <form action={bookAppointment} className="grid gap-5">
      <input type="hidden" name="vetProfileId" value={vetProfileId} />
      <input type="hidden" name="startsAt" value={selected ?? ""} />

      <div className="max-h-80 overflow-y-auto pr-1">
        {[...byDay.entries()].map(([day, times]) => (
          <div key={day} className="mb-4">
            <p className="mb-2 text-xs font-medium text-gray-500">{day}</p>
            <div className="flex flex-wrap gap-2">
              {times.map((iso) => (
                <button
                  key={iso}
                  type="button"
                  onClick={() => setSelected(iso)}
                  className={`rounded-md px-3 py-1.5 text-sm ${
                    selected === iso
                      ? "bg-gray-900 text-white"
                      : "bg-gray-100 hover:bg-gray-200"
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

      <div>
        <label className="mb-1 block text-sm font-medium" htmlFor="petId">Pet</label>
        <select id="petId" name="petId" className={field} required>
          {pets.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium" htmlFor="reason">
          Reason for visit
        </label>
        <textarea id="reason" name="reason" rows={3} className={field} />
      </div>

      <button
        type="submit"
        disabled={!selected}
        className="rounded-md bg-gray-900 px-4 py-2 text-sm text-white hover:bg-gray-700 disabled:bg-gray-300"
      >
        {selected
          ? `Book ${new Date(selected).toLocaleString(undefined, {
              weekday: "short",
              hour: "2-digit",
              minute: "2-digit",
            })}`
          : "Pick a time"}
      </button>
    </form>
  );
}
