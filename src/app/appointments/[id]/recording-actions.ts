"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/current-user";
import {
  inspectBlob,
  deleteDocument,
  getSignedReadUrl,
  ALLOWED_RECORDING_TYPES,
  MAX_RECORDING_BYTES,
} from "@/lib/blob";
import { baseContentType, recordingPrefix } from "@/lib/upload-rules";
import { fail, ok, type ActionState } from "@/lib/action-result";
import { isTranscriptionStale, transcriptionTimeoutMs } from "@/lib/transcription";

/** Turns whatever went wrong into something a vet can act on. */
function describeFailure(error: unknown) {
  if (error instanceof Error) {
    // AbortSignal.timeout() rejects with TimeoutError; an abort from
    // elsewhere with AbortError. Either way nothing came back in time.
    if (error.name === "TimeoutError" || error.name === "AbortError") {
      return "The transcription service took too long to respond. It may have been waking up, or the recording may be too long for it. Try again.";
    }
    if (error.name === "TypeError") {
      return "The transcription service could not be reached. Try again in a moment.";
    }
    return error.message;
  }
  return "Unknown error";
}

async function requireOwnAppointment(appointmentId: string) {
  const user = await getCurrentUser();
  const appointment = await prisma.appointment.findFirst({
    where: { id: appointmentId, vetProfile: { userId: user.id } },
    select: { id: true, petId: true },
  });
  if (!appointment) throw new Error("Not your consultation.");
  return { user, appointment };
}

/**
 * Attaches a recording the browser has already uploaded to its
 * appointment.
 *
 * As with documents, the audio went directly to the blob store and only
 * its pathname arrives here. The path must sit under this appointment's
 * prefix, and size and type come from the store, not from the caller.
 */
export async function registerRecording(input: {
  appointmentId: string;
  pathname: string;
  durationSeconds: number | null;
}): Promise<ActionState> {
  const appointmentId = String(input.appointmentId ?? "");
  const pathname = String(input.pathname ?? "");

  const user = await getCurrentUser();
  const appointment = await prisma.appointment.findFirst({
    where: { id: appointmentId, vetProfile: { userId: user.id } },
    select: { id: true },
  });
  if (!appointment) return fail("Not your consultation.");

  if (!pathname.startsWith(recordingPrefix(appointmentId))) return fail("Invalid upload.");

  const blob = await inspectBlob(pathname);
  if (!blob) return fail("Could not confirm the upload. Please try again.");
  if (blob.sizeBytes === 0) return fail("No audio received.");
  if (blob.sizeBytes > MAX_RECORDING_BYTES) return fail("Recording too large.");

  const contentType = baseContentType(blob.contentType);
  if (!ALLOWED_RECORDING_TYPES.includes(contentType)) return fail("Unexpected audio format.");

  const duration = Number(input.durationSeconds);
  const durationSeconds =
    Number.isFinite(duration) && duration > 0 ? Math.floor(duration) : null;

  const previous = await prisma.consultationRecording.findUnique({
    where: { appointmentId },
    select: { pathname: true },
  });

  // Upsert rather than create: a vet who records twice replaces the
  // earlier take rather than hitting a unique constraint.
  await prisma.consultationRecording.upsert({
    where: { appointmentId },
    update: {
      pathname: blob.pathname,
      contentType,
      sizeBytes: blob.sizeBytes,
      durationSeconds,
      status: "UPLOADED",
      transcript: null,
      segments: undefined,
      extraction: undefined,
      error: null,
      transcribedAt: null,
    },
    create: {
      appointmentId,
      pathname: blob.pathname,
      contentType,
      sizeBytes: blob.sizeBytes,
      durationSeconds,
    },
  });

  // The replaced take is no longer reachable from any row. Row first,
  // blob second: a failed delete leaves an orphan, which is untidy but
  // harmless.
  if (previous && previous.pathname !== blob.pathname) {
    try {
      await deleteDocument(previous.pathname);
    } catch {
      // orphaned blob; nothing points at it
    }
  }

  revalidatePath(`/appointments/${appointmentId}/review`);
  return ok;
}

/**
 * Hands the recording to the transcription service.
 *
 * The Python service is given a short-lived signed URL rather than the
 * audio itself: the file may be tens of megabytes, and pushing it
 * through a serverless function twice is wasteful. The URL expires in
 * minutes, so it is not a durable handle to the recording.
 */
export async function requestTranscription(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const appointmentId = String(formData.get("appointmentId") ?? "");
  await requireOwnAppointment(appointmentId);

  const recording = await prisma.consultationRecording.findUnique({
    where: { appointmentId },
  });
  if (!recording) return fail("There is no recording for this consultation.");

  // One request at a time. A second click while the first is running
  // would transcribe the same audio twice; but a recording that has sat
  // in this state for minutes has no request behind it any more, and has
  // to be retryable or it is stuck for good.
  if (recording.status === "TRANSCRIBING" && !isTranscriptionStale(recording)) {
    return fail("This recording is already being transcribed. Give it a minute.");
  }

  const serviceUrl = process.env.TRANSCRIPTION_SERVICE_URL;
  const serviceKey = process.env.TRANSCRIPTION_SERVICE_KEY;
  if (!serviceUrl || !serviceKey) {
    return fail("Transcription isn't set up on this deployment.");
  }

  await prisma.consultationRecording.update({
    where: { id: recording.id },
    data: { status: "TRANSCRIBING", error: null },
  });

  // Results are written only if this is still the recording that was
  // sent: a re-record during transcription replaces the audio, and a
  // transcript of the old take must not be attached to the new one.
  const sameTake = { id: recording.id, pathname: recording.pathname };

  try {
    const audioUrl = await getSignedReadUrl(recording.pathname);

    const response = await fetch(`${serviceUrl}/transcribe`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${serviceKey}`,
      },
      body: JSON.stringify({ audio_url: audioUrl }),
      // Without this the request waits as long as the service takes, and
      // if the function is killed first the status is never updated.
      signal: AbortSignal.timeout(transcriptionTimeoutMs()),
    });

    if (!response.ok) {
      throw new Error(`The transcription service returned an error (${response.status}).`);
    }

    const result = (await response.json()) as {
      transcript: string;
      segments: unknown;
      extraction: unknown;
    };

    await prisma.consultationRecording.updateMany({
      where: sameTake,
      data: {
        status: "TRANSCRIBED",
        transcript: result.transcript,
        segments: result.segments as never,
        extraction: result.extraction as never,
        transcribedAt: new Date(),
      },
    });
  } catch (error) {
    // The failure is recorded rather than swallowed, so the vet sees why
    // no draft appeared instead of an empty panel.
    await prisma.consultationRecording.updateMany({
      where: sameTake,
      data: { status: "FAILED", error: describeFailure(error) },
    });
  }

  revalidatePath(`/appointments/${appointmentId}/review`);

  // A failed transcription is reported by the page itself, from the
  // stored status, so it is still there after a reload. Returning it as
  // well would show the same failure twice.
  return ok;
}
