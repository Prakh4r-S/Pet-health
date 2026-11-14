import { requestTranscription } from "@/app/appointments/[id]/recording-actions";
import {
  acceptProposedField,
  acceptProposedMedication,
} from "@/app/appointments/[id]/proposal-actions";
import ActionForm from "@/components/action-form";
import SubmitButton from "@/components/submit-button";

const field = "w-full rounded-md border border-mist-deep px-3 py-2 text-sm";
const smallButton =
  "rounded-md bg-navy-900 px-3 py-1.5 text-sm text-white hover:bg-navy-700";

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
  /** In TRANSCRIBING for long enough that no request can still be behind it. */
  stalled: boolean;
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
    <ActionForm action={acceptProposedField} className="rounded-md border border-mist p-3">
      <input type="hidden" name="appointmentId" value={appointmentId} />
      <input type="hidden" name="field" value={name} />
      <label className="mb-1 block text-xs font-medium text-ink-soft">
        {FIELD_LABELS[name]}
      </label>
      {/* Editable before accepting — the vet should be able to correct a
          proposal rather than accept it and then fix it. */}
      <textarea name="value" rows={3} className={field} defaultValue={value} />
      <SubmitButton pendingLabel="Adding..." className={`${smallButton} mt-2`}>
        Add to note
      </SubmitButton>
    </ActionForm>
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
      <section className="rounded-lg border border-mist p-5">
        <h2 className="mb-2 font-medium">Draft from recording</h2>
        <p className="text-sm text-ink-faint">
          No audio was recorded for this consultation.
        </p>
      </section>
    );
  }

  const proposal = recording.extraction;

  return (
    <section className="rounded-lg border border-mist p-5">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-medium">Draft from recording</h2>
        {recording.durationSeconds && (
          <span className="text-xs text-ink-soft">
            {Math.floor(recording.durationSeconds / 60)}m {recording.durationSeconds % 60}s
          </span>
        )}
      </div>

      {recording.status === "UPLOADED" && (
        <ActionForm action={requestTranscription}>
          <input type="hidden" name="appointmentId" value={appointmentId} />
          <p className="mb-3 text-sm text-ink-soft">
            Transcribe the recording to get a suggested note. Everything it
            produces is a proposal — nothing is added to the record until you
            accept it.
          </p>
          <SubmitButton pendingLabel="Transcribing..." className={smallButton}>
            Transcribe
          </SubmitButton>
        </ActionForm>
      )}

      {recording.status === "TRANSCRIBING" && !recording.stalled && (
        <p className="text-sm text-ink-soft">
          Transcribing. This can take up to a minute. Reload the page to check.
        </p>
      )}

      {recording.status === "TRANSCRIBING" && recording.stalled && (
        <div>
          <p className="mb-3 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
            This transcription seems to have stalled — it started a while ago
            and never finished. The recording itself is safe.
          </p>
          <ActionForm action={requestTranscription}>
            <input type="hidden" name="appointmentId" value={appointmentId} />
            <SubmitButton pendingLabel="Transcribing..." className={smallButton}>
              Try again
            </SubmitButton>
          </ActionForm>
        </div>
      )}

      {recording.status === "FAILED" && (
        <div>
          <p className="mb-3 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-900">
            Transcription failed: {recording.error ?? "unknown error"}
          </p>
          <ActionForm action={requestTranscription}>
            <input type="hidden" name="appointmentId" value={appointmentId} />
            <SubmitButton pendingLabel="Transcribing..." className={smallButton}>
              Try again
            </SubmitButton>
          </ActionForm>
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
            <p className="text-sm text-ink-soft">
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
              <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-ink-soft">
                Medications mentioned
              </h3>
              <div className="grid gap-3">
                {proposal.medications.map((m, i) => (
                  <ActionForm
                    key={i}
                    action={acceptProposedMedication}
                    className="rounded-md border border-mist p-3"
                  >
                    <input type="hidden" name="appointmentId" value={appointmentId} />
                    <div className="flex flex-wrap items-end gap-2">
                      <div className="w-36">
                        <label className="mb-1 block text-xs text-ink-soft">Drug</label>
                        <input name="drug" className={field} defaultValue={m.drug} required />
                      </div>
                      <div className="w-24">
                        <label className="mb-1 block text-xs text-ink-soft">Dose</label>
                        <input
                          name="dose"
                          className={field}
                          defaultValue={m.dose ?? ""}
                          placeholder="not stated"
                          required
                        />
                      </div>
                      <div className="w-32">
                        <label className="mb-1 block text-xs text-ink-soft">Frequency</label>
                        <input
                          name="frequency"
                          className={field}
                          defaultValue={m.frequency ?? ""}
                          placeholder="not stated"
                          required
                        />
                      </div>
                      <div className="w-20">
                        <label className="mb-1 block text-xs text-ink-soft">Days</label>
                        <input
                          name="durationDays"
                          type="number"
                          min="1"
                          className={field}
                          defaultValue={m.duration_days ?? ""}
                        />
                      </div>
                      <SubmitButton pendingLabel="Adding..." className={smallButton}>
                        Prescribe
                      </SubmitButton>
                    </div>
                    {m.evidence && (
                      /* The sentence the drug was named in. Checking a
                         dose against what was actually said is real
                         verification; accepting a bare field is not. */
                      <p className="mt-2 text-xs italic text-ink-soft">
                        Heard: “{m.evidence}”
                      </p>
                    )}
                  </ActionForm>
                ))}
              </div>
            </div>
          )}

          {recording.transcript && (
            <details className="rounded-md border border-mist p-3">
              <summary className="cursor-pointer text-sm font-medium">
                Full transcript
              </summary>
              <p className="mt-2 whitespace-pre-wrap text-sm text-ink">
                {recording.transcript}
              </p>
            </details>
          )}
        </div>
      )}
    </section>
  );
}
