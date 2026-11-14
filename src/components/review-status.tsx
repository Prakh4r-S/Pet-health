/**
 * Where a consultation write-up stands, as one word the vet can read at
 * a glance.
 *
 *  - DRAFT        being written; not enough to sign off yet
 *  - TRANSCRIBING the recording is being turned into a suggested draft
 *  - READY        has a clinical assessment, so it can be finalised
 *  - FINALIZED    locked and visible to the owner
 *
 * Derived, never stored: every input already lives on the note and the
 * recording, and a stored copy could only ever disagree with them.
 */
export type ReviewStatus = "DRAFT" | "TRANSCRIBING" | "READY" | "FINALIZED";

export function getReviewStatus({
  noteStatus,
  assessment,
  recordingStatus,
  recordingStalled,
}: {
  noteStatus: "DRAFT" | "FINALISED" | null;
  assessment: string | null;
  recordingStatus: "UPLOADED" | "TRANSCRIBING" | "TRANSCRIBED" | "FAILED" | null;
  recordingStalled: boolean;
}): ReviewStatus {
  if (noteStatus === "FINALISED") return "FINALIZED";
  if (recordingStatus === "TRANSCRIBING" && !recordingStalled) return "TRANSCRIBING";
  if (assessment?.trim()) return "READY";
  return "DRAFT";
}

const STYLES: Record<ReviewStatus, string> = {
  DRAFT: "bg-mist text-ink border-mist-deep",
  TRANSCRIBING: "bg-amber-50 text-amber-900 border-amber-200",
  READY: "bg-aqua-100 text-navy-900 border-aqua-400",
  FINALIZED: "bg-navy-900 text-white border-navy-900",
};

const DESCRIPTIONS: Record<ReviewStatus, string> = {
  DRAFT: "Write the clinical assessment to make this record ready to finalize.",
  TRANSCRIBING: "The recording is being transcribed. Suggestions will appear alongside the record.",
  READY: "The record has an assessment. Review it, then finalize and share it with the owner.",
  FINALIZED: "Locked and shared with the owner. Corrections are added as amendments.",
};

export function ReviewStatusBadge({
  status,
  size = "md",
}: {
  status: ReviewStatus;
  size?: "sm" | "md";
}) {
  const pad = size === "sm" ? "px-2 py-0.5 text-[11px]" : "px-2.5 py-1 text-xs";
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border font-semibold tracking-wide ${pad} ${STYLES[status]}`}
    >
      {status === "TRANSCRIBING" && (
        <span aria-hidden className="size-1.5 animate-pulse rounded-full bg-amber-600" />
      )}
      {status}
    </span>
  );
}

const STEPS: ReviewStatus[] = ["DRAFT", "TRANSCRIBING", "READY", "FINALIZED"];

/**
 * The badge, what it means, and where it sits in the sequence. The
 * transcribing step is shown as skipped when there is no recording to
 * transcribe, rather than hidden, so the strip reads the same on every
 * consultation.
 */
export function ReviewStatusStrip({
  status,
  hasRecording,
}: {
  status: ReviewStatus;
  hasRecording: boolean;
}) {
  const current = STEPS.indexOf(status);

  return (
    <div className="rounded-lg border border-mist p-4">
      <div className="flex flex-wrap items-center gap-3">
        <ReviewStatusBadge status={status} />
        <p className="text-sm text-ink-soft">{DESCRIPTIONS[status]}</p>
      </div>
      <ol className="mt-4 grid grid-cols-4 gap-2" aria-label="Write-up progress">
        {STEPS.map((step, i) => {
          const skipped = step === "TRANSCRIBING" && !hasRecording;
          const done = i < current || (status === "FINALIZED" && i === current);
          const active = i === current && status !== "FINALIZED";
          return (
            <li key={step} aria-current={active ? "step" : undefined}>
              <div
                className={`h-1.5 rounded-full ${
                  skipped
                    ? "bg-mist"
                    : done
                      ? "bg-navy-900"
                      : active
                        ? "bg-aqua-400"
                        : "bg-mist-deep/60"
                }`}
              />
              <p
                className={`mt-1.5 text-[11px] font-medium tracking-wide ${
                  active ? "text-navy-900" : skipped ? "text-ink-faint" : "text-ink-soft"
                }`}
              >
                {step}
                {skipped && <span className="font-normal"> · no recording</span>}
              </p>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
