import { requestTranscription } from "@/app/appointments/[id]/recording-actions";
import {
  acceptProposedField,
  acceptProposedMedication,
} from "@/app/appointments/[id]/proposal-actions";

const field = "w-full rounded-md border border-gray-300 px-3 py-2 text-sm";
const smallButton =
  "rounded-md bg-pine-900 px-3 py-1.5 text-sm text-white hover:bg-pine-700";

export type ProposedMedication = {
  drug: string;
  dose: string | null;
  frequency: string | null;
  duration_days: number | null;
  instructions: string | null;
  evidence: string | null;
};

export type Proposal = {
  presenting_complaint: string | null;
  examination: string | null;
  assessment: string | null;
  plan: string | null;
  follow_up: string | null;
  medications: ProposedMedication[];
  uncertain: string[];
};

export type RecordingData = {
  status: "UPLOADED" | "TRANSCRIBING" | "TRANSCRIBED" | "FAILED";
  durationSeconds: number | null;
  transcript: string | null;
  extraction: Proposal | null;
  error: string | null;
} | null;

const FIELD_LABELS: Record<string, string> = {
  presentingComplaint: "Presenting complaint",
  examination: "Examination",
  assessment: "Assessment",
  plan: "Plan",
};

function ProposedField({
  appointmentId,
  name,
  value,
}: {
  appointmentId: string;
  name: keyof typeof FIELD_LABELS;
  value: string | null;
}) {
  if (!value) return null;

  return (
    <form action={acceptProposedField} className="rounded-md border border-gray-200 p-3">
      <input type="hidden" name="appointmentId" value={appointmentId} />
      <input type="hidden" name="field" value={name} />
      <label className="mb-1 block text-xs font-medium text-gray-500">
        {FIELD_LABELS[name]}
      </label>
      {/* Editable before accepting — the vet should be able to correct a
          proposal rather than accept it and then fix it. */}
      <textarea name="value" rows={3} className={field} defaultValue={value} />
      <button type="submit" className={`${smallButton} mt-2`}>
        Add to note
      </button>
    </form>
  );
}

export default function TranscriptPanel({
  appointmentId,
  recording,
  noteLocked,
}: {
  appointmentId: string;
  recording: RecordingData;
  noteLocked: boolean;
}) {
  if (!recording) {
    return (
      <section className="rounded-lg border border-gray-200 p-5">
        <h2 className="mb-2 font-medium">Draft from recording</h2>
        <p className="text-sm text-gray-400">
          No audio was recorded for this consultation.
        </p>
      </section>
    );
  }

  const proposal = recording.extraction;

  return (
    <section className="rounded-lg border border-gray-200 p-5">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-medium">Draft from recording</h2>
        {recording.durationSeconds && (
          <span className="text-xs text-gray-500">
            {Math.floor(recording.durationSeconds / 60)}m {recording.durationSeconds % 60}s
          </span>
        )}
      </div>

      {recording.status === "UPLOADED" && (
        <form action={requestTranscription}>
          <input type="hidden" name="appointmentId" value={appointmentId} />
          <p className="mb-3 text-sm text-gray-600">
            Transcribe the recording to get a suggested note. Everything it
            produces is a proposal — nothing is added to the record until you
            accept it.
          </p>
          <button type="submit" className={smallButton}>
            Transcribe
          </button>
        </form>
      )}

      {recording.status === "TRANSCRIBING" && (
        <p className="text-sm text-gray-600">
          Transcribing. This takes roughly as long as the recording. Reload the
          page to check.
        </p>
      )}

      {recording.status === "FAILED" && (
        <div>
          <p className="mb-3 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-900">
            Transcription failed: {recording.error ?? "unknown error"}
          </p>
          <form action={requestTranscription}>
            <input type="hidden" name="appointmentId" value={appointmentId} />
            <button type="submit" className={smallButton}>Try again</button>
          </form>
        </div>
      )}

      {recording.status === "TRANSCRIBED" && proposal && (
        <div className="grid gap-4">
          {proposal.uncertain.length > 0 && (
            <div className="rounded-md border border-amber-200 bg-amber-50 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-amber-900">
                Check these
              </p>
              <ul className="mt-1 list-disc pl-4 text-sm text-amber-900">
                {proposal.uncertain.map((u, i) => (
                  <li key={i}>{u}</li>
                ))}
              </ul>
            </div>
          )}

          {noteLocked ? (
            <p className="text-sm text-gray-500">
              The note is finalised, so these can no longer be added.
            </p>
          ) : (
            <div className="grid gap-3">
              <ProposedField
                appointmentId={appointmentId}
                name="presentingComplaint"
                value={proposal.presenting_complaint}
              />
              <ProposedField
                appointmentId={appointmentId}
                name="examination"
                value={proposal.examination}
              />
              <ProposedField
                appointmentId={appointmentId}
                name="assessment"
                value={proposal.assessment}
              />
              <ProposedField
                appointmentId={appointmentId}
                name="plan"
                value={proposal.plan}
              />
            </div>
          )}

          {proposal.medications.length > 0 && !noteLocked && (
            <div>
              <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-500">
                Medications mentioned
              </h3>
              <div className="grid gap-3">
                {proposal.medications.map((m, i) => (
                  <form
                    key={i}
                    action={acceptProposedMedication}
                    className="rounded-md border border-gray-200 p-3"
                  >
                    <input type="hidden" name="appointmentId" value={appointmentId} />
                    <div className="flex flex-wrap items-end gap-2">
                      <div className="w-36">
                        <label className="mb-1 block text-xs text-gray-500">Drug</label>
                        <input name="drug" className={field} defaultValue={m.drug} required />
                      </div>
                      <div className="w-24">
                        <label className="mb-1 block text-xs text-gray-500">Dose</label>
                        <input
                          name="dose"
                          className={field}
                          defaultValue={m.dose ?? ""}
                          placeholder="not stated"
                          required
                        />
                      </div>
                      <div className="w-32">
                        <label className="mb-1 block text-xs text-gray-500">Frequency</label>
                        <input
                          name="frequency"
                          className={field}
                          defaultValue={m.frequency ?? ""}
                          placeholder="not stated"
                          required
                        />
                      </div>
                      <div className="w-20">
                        <label className="mb-1 block text-xs text-gray-500">Days</label>
                        <input
                          name="durationDays"
                          type="number"
                          min="1"
                          className={field}
                          defaultValue={m.duration_days ?? ""}
                        />
                      </div>
                      <button type="submit" className={smallButton}>Prescribe</button>
                    </div>
                    {m.evidence && (
                      /* The sentence the drug was named in. Checking a
                         dose against what was actually said is real
                         verification; accepting a bare field is not. */
                      <p className="mt-2 text-xs italic text-gray-500">
                        Heard: “{m.evidence}”
                      </p>
                    )}
                  </form>
                ))}
              </div>
            </div>
          )}

          {recording.transcript && (
            <details className="rounded-md border border-gray-200 p-3">
              <summary className="cursor-pointer text-sm font-medium">
                Full transcript
              </summary>
              <p className="mt-2 whitespace-pre-wrap text-sm text-gray-700">
                {recording.transcript}
              </p>
            </details>
          )}
        </div>
      )}
    </section>
  );
}
