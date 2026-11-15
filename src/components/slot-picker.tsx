"use client";

import { useState } from "react";
import { bookAppointment } from "@/app/appointments/actions";
import ActionForm from "@/components/action-form";
import SubmitButton from "@/components/submit-button";
import IntakeFields, { type IntakePet } from "@/components/intake-fields";
import SlotGrid, { slotLabel } from "@/components/slot-grid";

type Props = {
  vetProfileId: string;
  pets: IntakePet[];
  slots: string[];
  /** Starts the pre-visit brief off, when the owner arrived by picking a symptom. */
  defaultConcern?: string;
};

export default function SlotPicker({ vetProfileId, pets, slots, defaultConcern }: Props) {
  const [selected, setSelected] = useState<string | null>(null);

  if (pets.length === 0) {
    return (
      <p className="rounded-md border border-dashed border-mist-deep p-6 text-center text-sm text-ink-soft">
        Add a pet before booking.
      </p>
    );
  }

  if (slots.length === 0) return <SlotGrid slots={slots} selected={null} onSelect={setSelected} />;

  return (
    <ActionForm action={bookAppointment} className="grid gap-5" resetOnSuccess={false}>
      <input type="hidden" name="vetProfileId" value={vetProfileId} />
      <input type="hidden" name="startsAt" value={selected ?? ""} />

      <div>
        <h3 className="mb-3 text-sm font-semibold text-navy-900">Choose a time</h3>
        <SlotGrid slots={slots} selected={selected} onSelect={setSelected} />
      </div>

      <div className="border-t border-mist pt-5">
        <h3 className="mb-1 text-sm font-semibold text-navy-900">Pre-visit brief</h3>
        <p className="mb-4 text-xs text-ink-soft">
          Your vet reads this before joining, so the call can start with
          the problem rather than with questions about it.
        </p>
        <IntakeFields pets={pets} defaultConcern={defaultConcern} />
      </div>

      <SubmitButton disabled={!selected} pendingLabel="Booking...">
        {selected ? `Book ${slotLabel(selected)}` : "Pick a time"}
      </SubmitButton>
    </ActionForm>
  );
}
