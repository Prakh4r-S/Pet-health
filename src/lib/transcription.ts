/**
 * How long to wait for the transcription service before giving up.
 *
 * Kept just under the review page's maxDuration, so that the request is
 * abandoned — and the recording marked failed, with a retry button —
 * before the platform kills the function and nothing gets recorded at
 * all. A deployment with a faster service or a longer function limit can
 * raise it with TRANSCRIPTION_TIMEOUT_MS.
 */
const DEFAULT_TIMEOUT_MS = 55_000;

export function transcriptionTimeoutMs() {
  const configured = Number(process.env.TRANSCRIPTION_TIMEOUT_MS);
  return Number.isFinite(configured) && configured >= 5_000 ? configured : DEFAULT_TIMEOUT_MS;
}

/**
 * After this long in TRANSCRIBING, the request that set it is assumed to
 * be gone — killed, crashed, or cut off before it could record a result.
 * Comfortably longer than any timeout above, so a request still running
 * is never mistaken for a dead one.
 */
export const TRANSCRIBING_STALE_AFTER_MS = 2 * 60_000;

export function isTranscriptionStale(
  recording: { status: string; updatedAt: Date },
  now: Date = new Date(),
) {
  return (
    recording.status === "TRANSCRIBING" &&
    now.getTime() - recording.updatedAt.getTime() > TRANSCRIBING_STALE_AFTER_MS
  );
}
