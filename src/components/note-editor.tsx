import {
  saveNoteDraft,
  finaliseNote,
  addAmendment,
  addPrescription,
  removePrescription,
} from "@/app/appointments/[id]/note-actions";

const field = "w-full rounded-md border border-gray-300 px-3 py-2 text-sm";
const label = "mb-1 block text-xs font-medium text-gray-600";
const button = "rounded-md bg-gray-900 px-4 py-2 text-sm text-white hover:bg-gray-700";

export type NoteData = {
  status: "DRAFT" | "FINALISED";
  scratch: string | null;
  presentingComplaint: string | null;
  examination: string | null;
  assessment: string | null;
  plan: string | null;
  followUpOn: string | null;
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

function Prescriptions({
  appointmentId,
  note,
}: {
  appointmentId: string;
  note: NoteData;
}) {
  const locked = note.status === "FINALISED";

  return (
    <section className="rounded-lg border border-gray-200 p-5">
      <h2 className="mb-4 font-medium">Prescriptions</h2>

      {note.prescriptions.length === 0 ? (
        <p className="text-sm text-gray-400">None.</p>
      ) : (
        <ul className="divide-y divide-gray-100">
          {note.prescriptions.map((p) => (
            <li key={p.id} className="flex items-start justify-between gap-4 py-3">
              <div>
                <p className="text-sm font-medium">{p.drug}</p>
                <p className="text-xs text-gray-600">
                  {p.dose} · {p.frequency}
                  {p.durationDays && ` · ${p.durationDays} days`}
                </p>
                {p.instructions && (
                  <p className="mt-1 text-xs text-gray-500">{p.instructions}</p>
                )}
              </div>
              {!locked && (
                <form action={removePrescription}>
                  <input type="hidden" name="appointmentId" value={appointmentId} />
                  <input type="hidden" name="id" value={p.id} />
                  <button type="submit" className="text-xs text-red-600 hover:underline">
                    Remove
                  </button>
                </form>
              )}
            </li>
          ))}
        </ul>
      )}

      {!locked && (
        <form action={addPrescription} className="mt-5 flex flex-wrap items-end gap-3">
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
          <button type="submit" className={button}>Add</button>
        </form>
      )}
    </section>
  );
}

export default function NoteEditor({
  appointmentId,
  note,
}: {
  appointmentId: string;
  note: NoteData;
}) {
  const locked = note.status === "FINALISED";

  return (
    <div className="grid gap-6">
      {note.scratch && (
        <section className="rounded-lg border border-gray-200 bg-gray-50 p-5">
          <h2 className="mb-2 text-sm font-medium text-gray-600">
            Notes taken during the call
          </h2>
          <p className="whitespace-pre-wrap text-sm text-gray-700">{note.scratch}</p>
        </section>
      )}

      <section className="rounded-lg border border-gray-200 p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-medium">Consultation record</h2>
          {locked && (
            <span className="rounded-full bg-green-100 px-2.5 py-1 text-xs text-green-800">
              Finalised {note.finalisedAt?.slice(0, 10)}
            </span>
          )}
        </div>

        {locked ? (
          <dl className="grid gap-4">
            <Field label="Presenting complaint" value={note.presentingComplaint} />
            <Field label="Examination" value={note.examination} />
            <Field label="Assessment" value={note.assessment} />
            <Field label="Plan" value={note.plan} />
            {note.followUpOn && <Field label="Follow up" value={note.followUpOn} />}
          </dl>
        ) : (
          <form action={saveNoteDraft} className="grid gap-4">
            <input type="hidden" name="appointmentId" value={appointmentId} />
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
              <label className={label} htmlFor="assessment">Assessment</label>
              <textarea
                id="assessment"
                name="assessment"
                rows={3}
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
            <div className="w-44">
              <label className={label} htmlFor="followUpOn">Follow up on</label>
              <input
                id="followUpOn"
                name="followUpOn"
                type="date"
                className={field}
                defaultValue={note.followUpOn ?? ""}
              />
            </div>
            <button type="submit" className={`${button} w-fit`}>Save draft</button>
          </form>
        )}
      </section>

      <Prescriptions appointmentId={appointmentId} note={note} />

      {!locked && (
        <form action={finaliseNote} className="rounded-lg border border-amber-200 bg-amber-50 p-5">
          <input type="hidden" name="appointmentId" value={appointmentId} />
          <p className="mb-3 text-sm text-amber-900">
            Finalising marks the consultation complete and locks this record.
            Corrections after that are added as amendments, not edits.
          </p>
          <button
            type="submit"
            className="rounded-md bg-amber-700 px-4 py-2 text-sm text-white hover:bg-amber-800"
          >
            Finalise record
          </button>
        </form>
      )}

      {(locked || note.amendments.length > 0) && (
        <section className="rounded-lg border border-gray-200 p-5">
          <h2 className="mb-4 font-medium">Amendments</h2>

          {note.amendments.length === 0 ? (
            <p className="text-sm text-gray-400">None.</p>
          ) : (
            <ul className="grid gap-3">
              {note.amendments.map((a) => (
                <li key={a.id} className="rounded-md border border-gray-100 p-3">
                  <p className="whitespace-pre-wrap text-sm">{a.body}</p>
                  <p className="mt-1 text-xs text-gray-500">
                    {a.authorName ?? "Vet"} · {a.createdAt}
                  </p>
                </li>
              ))}
            </ul>
          )}

          {locked && (
            <form action={addAmendment} className="mt-4 grid gap-2">
              <input type="hidden" name="appointmentId" value={appointmentId} />
              <textarea
                name="body"
                rows={3}
                className={field}
                placeholder="Correction or addition to the record above"
                required
              />
              <button type="submit" className={`${button} w-fit`}>Add amendment</button>
            </form>
          )}
        </section>
      )}
    </div>
  );
}

function Field({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <dt className="text-xs font-medium text-gray-500">{label}</dt>
      <dd className="mt-0.5 whitespace-pre-wrap text-sm">{value || "—"}</dd>
    </div>
  );
}
