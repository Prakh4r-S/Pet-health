"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/current-user";
import { uploadDocument, getSignedReadUrl } from "@/lib/blob";

const MAX_RECORDING_BYTES = 60 * 1024 * 1024;

async function requireOwnAppointment(appointmentId: string) {
  const user = await getCurrentUser();
  const appointment = await prisma.appointment.findFirst({
    where: { id: appointmentId, vetProfile: { userId: user.id } },
    select: { id: true, petId: true },
  });
  if (!appointment) throw new Error("Not your consultation.");
  return { user, appointment };
}

export async function uploadRecording(formData: FormData) {
  const appointmentId = String(formData.get("appointmentId") ?? "");
  const { appointment } = await requireOwnAppointment(appointmentId);

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) throw new Error("No audio received.");
  if (file.size > MAX_RECORDING_BYTES) throw new Error("Recording too large.");

  const durationSeconds = Number(formData.get("durationSeconds") ?? 0) || null;
  const bytes = Buffer.from(await file.arrayBuffer());

  const { pathname } = await uploadDocument({
    petId: appointment.petId,
    filename: `consultation-${appointmentId}.webm`,
    contentType: "audio/webm",
    body: bytes,
  });

  // Upsert rather than create: a vet who records twice replaces the
  // earlier take rather than hitting a unique constraint.
  await prisma.consultationRecording.upsert({
    where: { appointmentId },
    update: {
      pathname,
      contentType: "audio/webm",
      sizeBytes: bytes.byteLength,
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
      pathname,
      contentType: "audio/webm",
      sizeBytes: bytes.byteLength,
      durationSeconds,
    },
  });

  revalidatePath(`/appointments/${appointmentId}/review`);
}

/**
 * Hands the recording to the transcription service.
 *
 * The Python service is given a short-lived signed URL rather than the
 * audio itself: the file may be tens of megabytes, and pushing it
 * through a serverless function twice is wasteful. The URL expires in
 * minutes, so it is not a durable handle to the recording.
 */
export async function requestTranscription(formData: FormData) {
  const appointmentId = String(formData.get("appointmentId") ?? "");
  await requireOwnAppointment(appointmentId);

  const recording = await prisma.consultationRecording.findUniqueOrThrow({
    where: { appointmentId },
  });

  const serviceUrl = process.env.TRANSCRIPTION_SERVICE_URL;
  const serviceKey = process.env.TRANSCRIPTION_SERVICE_KEY;
  if (!serviceUrl || !serviceKey) {
    throw new Error("Transcription service is not configured.");
  }

  await prisma.consultationRecording.update({
    where: { id: recording.id },
    data: { status: "TRANSCRIBING", error: null },
  });

  try {
    const audioUrl = await getSignedReadUrl(recording.pathname);

    const response = await fetch(`${serviceUrl}/transcribe`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${serviceKey}`,
      },
      body: JSON.stringify({ audio_url: audioUrl }),
    });

    if (!response.ok) {
      throw new Error(`Transcription service returned ${response.status}`);
    }

    const result = (await response.json()) as {
      transcript: string;
      segments: unknown;
      extraction: unknown;
    };

    await prisma.consultationRecording.update({
      where: { id: recording.id },
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
    await prisma.consultationRecording.update({
      where: { id: recording.id },
      data: {
        status: "FAILED",
        error: error instanceof Error ? error.message : "Unknown error",
      },
    });
  }

  revalidatePath(`/appointments/${appointmentId}/review`);
}


