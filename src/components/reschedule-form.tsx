"use client";

import { useState } from "react";
import { rescheduleAppointment } from "@/app/appointments/actions";
import ActionForm from "@/components/action-form";
import SubmitButton from "@/components/submit-button";
import SlotGrid, { slotLabel } from "@/components/slot-grid";

/** Pick a new time for an existing appointment. Nothing else is asked. */
export default function RescheduleForm({
  appointmentId,
  slots,
}: {
  appointmentId: string;
  slots: string[];
}) {
  const [selected, setSelected] = useState<string | null>(null);

  if (slots.length === 0) return <SlotGrid slots={slots} selected={null} onSelect={setSelected} />;

  return (
    <ActionForm action={rescheduleAppointment} className="grid gap-5" resetOnSuccess={false}>
      <input type="hidden" name="id" value={appointmentId} />
      <input type="hidden" name="startsAt" value={selected ?? ""} />

      <SlotGrid slots={slots} selected={selected} onSelect={setSelected} />

      <SubmitButton disabled={!selected} pendingLabel="Moving...">
        {selected ? `Move to ${slotLabel(selected)}` : "Pick a new time"}
      </SubmitButton>
    </ActionForm>
  );
}
