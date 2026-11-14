"use client";

import { startTransition, useActionState, useEffect, useRef, useState } from "react";
import { finaliseNote } from "@/app/appointments/[id]/note-actions";
import { initialActionState, type ActionState } from "@/lib/action-result";

type Rx = { id: string; drug: string; dose: string; frequency: string; durationDays: number | null };

type Snapshot = {
  presentingComplaint: string;
  assessment: string;
  plan: string;
  followUpOn: string;
  followUpNote: string;
};

/**
 * "Finalize & Share with Owner": a confirmation step in front of the one
 * irreversible action on the review page.
 *
 * A browser confirm() box asks "are you sure?" and nothing else. This
 * shows what the owner is about to receive — the assessment, the plan,
 * the follow-up, every prescription — read from the form as it stands,
 * so the vet confirms the record rather than the click. It also names
 * anything still loose: suggested medications not yet added, a
 * transcription still running.
 *
 * Confirming sends the whole draft form, unsaved edits included, and
 * the server saves and locks it in one step.
 */
export default function FinalizeShare({
  formId,
  petName,
  ownerName,
  prescriptions,
  unaddedSuggestions,
  transcribing,
}: {
  formId: string;
  petName: string;
  ownerName: string | null;
  prescriptions: Rx[];
  unaddedSuggestions: number;
  transcribing: boolean;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [reviewed, setReviewed] = useState(false);
  const [state, dispatch, pending] = useActionState<ActionState, FormData>(
    finaliseNote,
    initialActionState,
  );

  useEffect(() => {
    if (state.success) dialogRef.current?.close();
  }, [state]);

  const readForm = () => {
    const form = document.getElementById(formId) as HTMLFormElement | null;
    return form ? new FormData(form) : null;
  };

  const open = () => {
    const data = readForm();
    const get = (k: string) => String(data?.get(k) ?? "").trim();
    setSnapshot({
      presentingComplaint: get("presentingComplaint"),
      assessment: get("assessment"),
      plan: get("plan"),
      followUpOn: get("followUpOn"),
      followUpNote: get("followUpNote"),
    });
    setReviewed(false);
    dialogRef.current?.showModal();
  };

  const confirm = () => {
    const data = readForm();
    if (!data || pending) return;
    startTransition(() => dispatch(data));
  };

  const owner = ownerName ?? "the owner";
  const missingAssessment = snapshot !== null && !snapshot.assessment;

  return (
    <section className="rounded-lg border-2 border-navy-900 bg-aqua-50 p-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="max-w-md">
          <h2 className="text-base text-navy-900">Finalize &amp; share with owner</h2>
          <p className="mt-1 text-sm text-ink-soft">
            Locks this record, marks the consultation complete and makes the
            assessment, follow-up and prescriptions visible to {owner} in{" "}
            {petName}&apos;s records.
          </p>
        </div>
        <button
          type="button"
          onClick={open}
          className="rounded-md bg-navy-900 px-5 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-navy-700"
        >
          Finalize &amp; Share with Owner
        </button>
      </div>

      <dialog
        ref={dialogRef}
        aria-labelledby="finalize-title"
        className="m-auto w-[min(36rem,calc(100vw-2rem))] rounded-xl border border-mist p-0 text-ink shadow-xl backdrop:bg-navy-900/40"
      >
        {snapshot && (
          <div className="grid max-h-[85vh] grid-rows-[auto_1fr_auto]">
            <header className="border-b border-mist px-5 py-4">
              <h2 id="finalize-title" className="text-lg text-navy-900">
                Share this record with {owner}?
              </h2>
              <p className="mt-0.5 text-sm text-ink-soft">
                This is what they will see. After this, the record is locked;
                corrections can only be added as amendments.
              </p>
            </header>

            <div className="grid gap-4 overflow-y-auto px-5 py-4">
              {(transcribing || unaddedSuggestions > 0) && (
                <ul className="grid gap-1 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                  {transcribing && (
                    <li>
                      The recording is still being transcribed. Its suggestions
                      can&apos;t be added once the record is locked.
                    </li>
                  )}
                  {unaddedSuggestions > 0 && (
                    <li>
                      {unaddedSuggestions} medication
                      {unaddedSuggestions === 1 ? " was" : "s were"} mentioned on the
                      call but {unaddedSuggestions === 1 ? "hasn't" : "haven't"} been
                      prescribed.
                    </li>
                  )}
                </ul>
              )}

              <Preview label="Presenting complaint" value={snapshot.presentingComplaint} />
              <Preview
                label="Clinical assessment"
                value={snapshot.assessment}
                missing="Required — add an assessment before finalizing."
              />
              <Preview label="Plan" value={snapshot.plan} />
              <Preview
                label="Follow-up"
                value={
                  [
                    snapshot.followUpOn &&
                      new Date(`${snapshot.followUpOn}T00:00`).toLocaleDateString(undefined, {
                        weekday: "short",
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      }),
                    snapshot.followUpNote,
                  ]
                    .filter(Boolean)
                    .join(" — ") || ""
                }
                missing="No follow-up recommended."
                muted
              />

              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-navy-700">
                  Prescriptions ({prescriptions.length})
                </p>
                {prescriptions.length === 0 ? (
                  <p className="mt-1 text-sm text-ink-faint">None prescribed.</p>
                ) : (
                  <ul className="mt-1.5 grid gap-1.5">
                    {prescriptions.map((p) => (
                      <li key={p.id} className="rounded-md bg-aqua-50 px-3 py-2 text-sm">
                        <span className="font-medium">{p.drug}</span>{" "}
                        <span className="text-ink-soft">
                          {p.dose} · {p.frequency}
                          {p.durationDays != null && ` · ${p.durationDays} days`}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            <footer className="grid gap-3 border-t border-mist px-5 py-4">
              <label className="flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={reviewed}
                  onChange={(e) => setReviewed(e.target.checked)}
                  disabled={missingAssessment}
                  className="mt-0.5 size-4 accent-navy-900"
                />
                I have reviewed this record, including any text suggested from
                the recording, and it is accurate.
              </label>

              {state.error && !pending && (
                <p
                  role="alert"
                  className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900"
                >
                  {state.error}
                </p>
              )}

              <div className="flex flex-wrap justify-end gap-2">
                <button
                  type="button"
                  onClick={() => dialogRef.current?.close()}
                  className="rounded-md border border-mist-deep px-4 py-2 text-sm hover:bg-mist"
                >
                  Keep editing
                </button>
                <button
                  type="button"
                  onClick={confirm}
                  disabled={!reviewed || missingAssessment || pending}
                  aria-busy={pending}
                  className="rounded-md bg-navy-900 px-4 py-2 text-sm font-medium text-white hover:bg-navy-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {pending ? "Finalizing..." : "Finalize & Share"}
                </button>
              </div>
            </footer>
          </div>
        )}
      </dialog>
    </section>
  );
}

function Preview({
  label,
  value,
  missing,
  muted,
}: {
  label: string;
  value: string;
  missing?: string;
  muted?: boolean;
}) {
  if (!value && !missing) return null;
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-navy-700">{label}</p>
      {value ? (
        <p className="mt-1 whitespace-pre-wrap text-sm">{value}</p>
      ) : (
        <p className={`mt-1 text-sm ${muted ? "text-ink-faint" : "text-red-700"}`}>{missing}</p>
      )}
    </div>
  );
}
