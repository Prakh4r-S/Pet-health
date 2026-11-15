import {
  saveNoteDraft,
  addAmendment,
  addPrescription,
  removePrescription,
} from "@/app/appointments/[id]/note-actions";
import { acceptProposedMedication } from "@/app/appointments/[id]/proposal-actions";
import ActionForm from "@/components/action-form";
import SubmitButton from "@/components/submit-button";
import FollowUpPicker from "@/components/follow-up-picker";
import FinalizeShare from "@/components/finalize-share";
import type { ProposedMedication } from "@/components/transcript-panel";

const field = "w-full rounded-md border border-mist-deep px-3 py-2 text-sm placeholder:text-ink-faint";
const label = "mb-1 block text-xs font-medium text-ink-soft";
const card = "rounded-lg border border-mist p-5";
const smallButton = "rounded-md bg-navy-900 px-3 py-1.5 text-sm text-white hover:bg-navy-700";

// Not imported from submit-button: that is a client module, and a value
// imported from one into a server component arrives as a client
// reference, not the string — the button rendered with no styles at all.
const primaryButton = "rounded-md bg-navy-900 px-4 py-2 text-sm text-white hover:bg-navy-700";

const DRAFT_FORM_ID = "consultation-draft";

export type NoteData = {
  status: "DRAFT" | "FINALISED";
  scratch: string | null;
  presentingComplaint: string | null;
  examination: string | null;
  assessment: string | null;
  plan: string | null;
  followUpOn: string | null;
  followUpNote: string | null;
  finalisedAt: string | null;
  prescriptions: {
    id: string;
    drug: string;
    dose: string;
    frequency: string;
    durationDays: number | null;
    instructions: string | null;
  }[];
  amendments: { id: string; body: string; createdAt: string; authorName: string | null }[];
};

function SectionHeading({ step, title, hint }: { step: number; title: string; hint?: string }) {
  return (
    <div className="mb-4 flex items-start gap-3">
      <span
        aria-hidden
        className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-navy-900 text-xs font-semibold text-white"
      >
        {step}
      </span>
      <div>
        <h2 className="font-medium text-navy-900">{title}</h2>
        {hint && <p className="text-xs text-ink-soft">{hint}</p>}
      </div>
    </div>
  );
}

const normalise = (drug: string) => drug.trim().toLowerCase();

/** Medications suggested from the recording that are not yet prescribed. */
export function unaddedSuggestions(
  suggestions: ProposedMedication[],
  prescriptions: NoteData["prescriptions"],
) {
  const prescribed = new Set(prescriptions.map((p) => normalise(p.drug)));
  return suggestions.filter((m) => !prescribed.has(normalise(m.drug)));
}

/**
 * Medications heard on the call, turned into prescriptions with one
 * click each.
 *
 * One click only when the transcript gave a dose and a frequency; a
 * suggestion missing either opens as an editable row instead, so a gap
 * is never papered over with a plausible default. Each one is still a
 * deliberate, individual decision — there is no "add all".
 */
function SuggestedPrescriptions({
  appointmentId,
  suggestions,
  prescriptions,
}: {
  appointmentId: string;
  suggestions: ProposedMedication[];
  prescriptions: NoteData["prescriptions"];
}) {
  if (suggestions.length === 0) return null;
  const prescribed = new Set(prescriptions.map((p) => normalise(p.drug)));

  return (
    <div className="mb-5 rounded-md border border-aqua-100 bg-aqua-50 p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-navy-700">
          Drafted from the recording
        </h3>
        <span className="text-xs text-ink-soft">Check each against what was said</span>
      </div>
      <ul className="grid gap-2">
        {suggestions.map((m, i) => {
          const added = prescribed.has(normalise(m.drug));
          const complete = Boolean(m.dose && m.frequency);

          if (added) {
            return (
              <li
                key={i}
                className="flex items-center justify-between gap-3 rounded-md bg-white/60 px-3 py-2 text-sm text-ink-soft"
              >
                <span>
                  <span className="font-medium text-ink">{m.drug}</span> is on the prescription
                  list
                </span>
                <span className="text-xs font-medium text-aqua-600">Added ✓</span>
              </li>
            );
          }

          return (
            <li key={i} className="rounded-md border border-mist bg-white p-3">
              {complete ? (
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium">{m.drug}</p>
                    <p className="text-xs text-ink-soft">
                      {m.dose} · {m.frequency}
                      {m.duration_days != null && ` · ${m.duration_days} days`}
                      {m.instructions && ` · ${m.instructions}`}
                    </p>
                  </div>
                  <ActionForm action={acceptProposedMedication}>
                    <input type="hidden" name="appointmentId" value={appointmentId} />
                    <input type="hidden" name="drug" value={m.drug} />
                    <input type="hidden" name="dose" value={m.dose ?? ""} />
                    <input type="hidden" name="frequency" value={m.frequency ?? ""} />
                    <input type="hidden" name="durationDays" value={m.duration_days ?? ""} />
                    <input type="hidden" name="instructions" value={m.instructions ?? ""} />
                    <SubmitButton pendingLabel="Adding..." className={smallButton}>
                      + Prescribe
                    </SubmitButton>
                  </ActionForm>
                </div>
              ) : (
                <ActionForm action={acceptProposedMedication} className="grid gap-2">
                  <input type="hidden" name="appointmentId" value={appointmentId} />
                  <p className="text-xs text-amber-900">
                    The recording didn&apos;t give a full dose and frequency — fill
                    them in to prescribe.
                  </p>
                  <div className="flex flex-wrap items-end gap-2">
                    <div className="w-36">
                      <label className={label} htmlFor={`proposed-${i}-drug`}>Drug</label>
                      <input
                        id={`proposed-${i}-drug`}
                        name="drug"
                        className={field}
                        defaultValue={m.drug}
                        required
                      />
                    </div>
                    <div className="w-24">
                      <label className={label} htmlFor={`proposed-${i}-dose`}>Dose</label>
                      <input
                        id={`proposed-${i}-dose`}
                        name="dose"
                        className={field}
                        defaultValue={m.dose ?? ""}
                        placeholder="not stated"
                        required
                      />
                    </div>
                    <div className="w-32">
                      <label className={label} htmlFor={`proposed-${i}-frequency`}>Frequency</label>
                      <input
                        id={`proposed-${i}-frequency`}
                        name="frequency"
                        className={field}
                        defaultValue={m.frequency ?? ""}
                        placeholder="not stated"
                        required
                      />
                    </div>
                    <div className="w-20">
                      <label className={label} htmlFor={`proposed-${i}-durationDays`}>Days</label>
                      <input
                        id={`proposed-${i}-durationDays`}
                        name="durationDays"
                        type="number"
                        min="1"
                        className={field}
                        defaultValue={m.duration_days ?? ""}
                      />
                    </div>
                    <input type="hidden" name="instructions" value={m.instructions ?? ""} />
                    <SubmitButton pendingLabel="Adding..." className={smallButton}>
                      Prescribe
                    </SubmitButton>
                  </div>
                </ActionForm>
              )}
              {m.evidence && (
                /* The sentence the drug was named in. Checking a dose
                   against what was actually said is real verification;
                   accepting a bare field is not. */
                <p className="mt-2 text-xs italic text-ink-soft">Heard: “{m.evidence}”</p>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function Prescriptions({
  appointmentId,
  note,
  suggestions,
  step,
}: {
  appointmentId: string;
  note: NoteData;
  suggestions: ProposedMedication[];
  step: number;
}) {
  const locked = note.status === "FINALISED";

  return (
    <section id="prescriptions" className={`${card} scroll-mt-6`}>
      <SectionHeading
        step={step}
        title="Prescriptions"
        hint={locked ? undefined : "Add from the recording in one click, or enter by hand."}
      />

      {!locked && (
        <SuggestedPrescriptions
          appointmentId={appointmentId}
          suggestions={suggestions}
          prescriptions={note.prescriptions}
        />
      )}

      {note.prescriptions.length === 0 ? (
        <p className="text-sm text-ink-faint">Nothing prescribed yet.</p>
      ) : (
        <ul className="divide-y divide-mist rounded-md border border-mist">
          {note.prescriptions.map((p) => (
            <li key={p.id} className="flex items-start justify-between gap-4 px-3 py-3">
              <div>
                <p className="text-sm font-medium">{p.drug}</p>
                <p className="text-xs text-ink-soft">
                  {p.dose} · {p.frequency}
                  {p.durationDays != null && ` · ${p.durationDays} days`}
                </p>
                {p.instructions && (
                  <p className="mt-1 text-xs text-ink-soft">{p.instructions}</p>
                )}
              </div>
              {!locked && (
                <ActionForm action={removePrescription} confirm="Remove this prescription?">
                  <input type="hidden" name="appointmentId" value={appointmentId} />
                  <input type="hidden" name="id" value={p.id} />
                  <SubmitButton
                    pendingLabel="Removing..."
                    className="text-xs text-red-700 hover:underline"
                  >
                    Remove
                  </SubmitButton>
                </ActionForm>
              )}
            </li>
          ))}
        </ul>
      )}

      {!locked && (
        <details className="group mt-4">
          <summary className="cursor-pointer text-sm font-medium text-navy-700 hover:underline">
            Add a prescription by hand
          </summary>
          <ActionForm action={addPrescription} className="mt-3 flex flex-wrap items-end gap-3">
            <input type="hidden" name="appointmentId" value={appointmentId} />
            <div className="w-40">
              <label className={label} htmlFor="drug">Drug</label>
              <input id="drug" name="drug" className={field} required />
            </div>
            <div className="w-28">
              <label className={label} htmlFor="dose">Dose</label>
              <input id="dose" name="dose" className={field} placeholder="5 mg" required />
            </div>
            <div className="w-36">
              <label className={label} htmlFor="frequency">Frequency</label>
              <input
                id="frequency"
                name="frequency"
                className={field}
                placeholder="twice daily"
                required
              />
            </div>
            <div className="w-24">
              <label className={label} htmlFor="durationDays">Days</label>
              <input
                id="durationDays"
                name="durationDays"
                type="number"
                min="1"
                className={field}
              />
            </div>
            <div className="min-w-40 flex-1">
              <label className={label} htmlFor="instructions">Instructions</label>
              <input id="instructions" name="instructions" className={field} />
            </div>
            <SubmitButton pendingLabel="Adding...">Add</SubmitButton>
          </ActionForm>
        </details>
      )}
    </section>
  );
}

/**
 * The vet's write-up of a consultation, in the order it is done:
 * clinical assessment, follow-up, prescriptions, then finalise.
 *
 * The first two sections are one form split across two cards, so a
 * single "Save draft" covers both and finalising can send everything on
 * screen at once. Prescriptions are separate rows, each saved as it is
 * added, so they sit outside it.
 */
export default function NoteEditor({
  appointmentId,
  note,
  petName,
  ownerName,
  ownerConcern,
  suggestedMedications,
  transcribing,
}: {
  appointmentId: string;
  note: NoteData;
  petName: string;
  ownerName: string | null;
  /** From the pre-visit brief; offered as a starting point, never prefilled. */
  ownerConcern: string | null;
  suggestedMedications: ProposedMedication[];
  transcribing: boolean;
}) {
  const locked = note.status === "FINALISED";

  return (
    <div className="grid content-start gap-6">
      {note.scratch && (
        <section className="rounded-lg border border-mist bg-aqua-50 p-5">
          <h2 className="mb-2 text-sm font-medium text-ink-soft">
            Your notes from during the call
          </h2>
          <p className="whitespace-pre-wrap text-sm text-ink">{note.scratch}</p>
        </section>
      )}

      {locked ? (
        <>
          <section className={card}>
            <SectionHeading step={1} title="Clinical assessment / notes" />
            <dl className="grid gap-4">
              <Field label="Presenting complaint" value={note.presentingComplaint} />
              <Field label="Examination" value={note.examination} />
              <Field label="Assessment" value={note.assessment} />
              <Field label="Plan" value={note.plan} />
            </dl>
          </section>
          <section className={card}>
            <SectionHeading step={2} title="Follow-up recommendation" />
            <dl className="grid gap-4">
              <Field label="Follow up on" value={note.followUpOn} />
              <Field label="Recommendation" value={note.followUpNote} />
            </dl>
          </section>
        </>
      ) : (
        <ActionForm
          id={DRAFT_FORM_ID}
          action={saveNoteDraft}
          successMessage="Draft saved."
          resetOnSuccess={false}
          className="grid gap-6"
        >
          <input type="hidden" name="appointmentId" value={appointmentId} />

          <section className={card}>
            <SectionHeading
              step={1}
              title="Clinical assessment / notes"
              hint="An assessment is required before the record can be finalized."
            />
            <div className="grid gap-4">
              <div>
                <label className={label} htmlFor="presentingComplaint">
                  Presenting complaint
                </label>
                <textarea
                  id="presentingComplaint"
                  name="presentingComplaint"
                  rows={2}
                  className={field}
                  defaultValue={note.presentingComplaint ?? ""}
                  placeholder={ownerConcern ? `Owner reported: ${ownerConcern}` : undefined}
                />
              </div>
              <div>
                <label className={label} htmlFor="examination">Examination</label>
                <textarea
                  id="examination"
                  name="examination"
                  rows={3}
                  className={field}
                  defaultValue={note.examination ?? ""}
                />
              </div>
              <div>
                <label className={label} htmlFor="assessment">
                  Assessment <span className="text-red-700">*</span>
                </label>
                <textarea
                  id="assessment"
                  name="assessment"
                  rows={4}
                  className={field}
                  defaultValue={note.assessment ?? ""}
                />
              </div>
              <div>
                <label className={label} htmlFor="plan">Plan</label>
                <textarea
                  id="plan"
                  name="plan"
                  rows={3}
                  className={field}
                  defaultValue={note.plan ?? ""}
                />
              </div>
            </div>
          </section>

          <section className={card}>
            <SectionHeading
              step={2}
              title="Follow-up recommendation"
              hint="When to check in again, and what to watch for until then."
            />
            <div className="grid gap-4">
              <div>
                <label className={label} htmlFor="followUpOn">Follow up on</label>
                <FollowUpPicker id="followUpOn" defaultValue={note.followUpOn} />
              </div>
              <div>
                <label className={label} htmlFor="followUpNote">Recommendation</label>
                <textarea
                  id="followUpNote"
                  name="followUpNote"
                  rows={2}
                  className={field}
                  defaultValue={note.followUpNote ?? ""}
                  placeholder="e.g. Recheck if still limping after 5 days, sooner if it gets worse."
                />
              </div>
            </div>
          </section>

          <div className="sticky bottom-3 z-10 flex items-center gap-3 rounded-lg border border-mist bg-white/95 px-4 py-3 shadow-sm backdrop-blur">
            <SubmitButton pendingLabel="Saving..." className={`${primaryButton} w-fit`}>
              Save draft
            </SubmitButton>
            <p className="text-xs text-ink-soft">
              Saves sections 1 and 2. Finalizing also saves whatever is on screen.
            </p>
          </div>
        </ActionForm>
      )}

      <Prescriptions
        appointmentId={appointmentId}
        note={note}
        suggestions={suggestedMedications}
        step={3}
      />

      {!locked && (
        <FinalizeShare
          formId={DRAFT_FORM_ID}
          petName={petName}
          ownerName={ownerName}
          prescriptions={note.prescriptions}
          unaddedSuggestions={unaddedSuggestions(suggestedMedications, note.prescriptions).length}
          transcribing={transcribing}
        />
      )}

      {locked && (
        <p className="rounded-lg border border-aqua-100 bg-aqua-50 px-4 py-3 text-sm text-navy-900">
          Shared with {ownerName ?? "the owner"}
          {note.finalisedAt && ` on ${note.finalisedAt.slice(0, 10)}`}. They can see the
          assessment, follow-up and prescriptions in {petName}&apos;s records.
        </p>
      )}

      {(locked || note.amendments.length > 0) && (
        <section className={card}>
          <h2 className="mb-4 font-medium">Amendments</h2>

          {note.amendments.length === 0 ? (
            <p className="text-sm text-ink-faint">None.</p>
          ) : (
            <ul className="grid gap-3">
              {note.amendments.map((a) => (
                <li key={a.id} className="rounded-md border border-mist p-3">
                  <p className="whitespace-pre-wrap text-sm">{a.body}</p>
                  <p className="mt-1 text-xs text-ink-soft">
                    {a.authorName ?? "Vet"} · {a.createdAt}
                  </p>
                </li>
              ))}
            </ul>
          )}

          {locked && (
            <ActionForm action={addAmendment} className="mt-4 grid gap-2">
              <input type="hidden" name="appointmentId" value={appointmentId} />
              <label htmlFor="amendment-body" className={label}>
                Add an amendment
              </label>
              <textarea
                id="amendment-body"
                name="body"
                rows={3}
                className={field}
                placeholder="Correction or addition to the record above"
                required
              />
              <SubmitButton pendingLabel="Adding..." className={`${primaryButton} w-fit`}>
                Add amendment
              </SubmitButton>
            </ActionForm>
          )}
        </section>
      )}
    </div>
  );
}

function Field({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <dt className="text-xs font-medium text-ink-soft">{label}</dt>
      <dd className="mt-0.5 whitespace-pre-wrap text-sm">{value || "—"}</dd>
    </div>
  );
}
