"use client";

import { useEffect, useRef, useState } from "react";
import { saveScratch } from "@/app/appointments/[id]/note-actions";

/**
 * A notepad the vet can type in during the call.
 *
 * Deliberately unstructured. Trying to fill in a clinical record while
 * also conducting a consultation produces bad notes and a distracted
 * vet; this is somewhere to dump observations, and the structured
 * write-up happens afterwards on the review page.
 *
 * Saves are debounced rather than on every keystroke — a server action
 * per character would be absurd, and losing the last two seconds of
 * typing if a tab closes is an acceptable trade.
 */
export default function NotesPanel({ appointmentId }: { appointmentId: string }) {
  const [value, setValue] = useState("");
  const [status, setStatus] = useState<"idle" | "saving" | "saved">("idle");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dirty = useRef(false);

  useEffect(() => {
    if (!dirty.current) return;

    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      setStatus("saving");
      try {
        await saveScratch(appointmentId, value);
        setStatus("saved");
      } catch {
        setStatus("idle");
      }
    }, 1500);

    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [value, appointmentId]);

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-3">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-medium">Notes</h3>
        <span className="text-xs text-gray-400">
          {status === "saving" ? "Saving..." : status === "saved" ? "Saved" : ""}
        </span>
      </div>
      <textarea
        value={value}
        onChange={(e) => {
          dirty.current = true;
          setValue(e.target.value);
          setStatus("idle");
        }}
        rows={6}
        placeholder="Observations during the call — you'll write these up properly afterwards."
        className="w-full resize-y rounded-md border border-gray-300 px-3 py-2 text-sm"
      />
    </div>
  );
}
