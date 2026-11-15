import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/current-user";
import { getPatientSummary } from "@/lib/patient-summary";
import { isTranscriptionStale } from "@/lib/transcription";
import PatientPanel from "@/components/patient-panel";
import NoteEditor from "@/components/note-editor";
import LocalTime from "@/components/local-time";
import TranscriptPanel, { type Proposal } from "@/components/transcript-panel";
import IntakeSummary from "@/components/intake-summary";
import { ReviewStatusStrip, getReviewStatus } from "@/components/review-status";
import { intakeFromAppointment } from "@/lib/visit-intake";

export const dynamic = "force-dynamic";

// Transcription is requested from this page and waits on another service.
// This is the ceiling for that wait; the request itself gives up slightly
// sooner (see lib/transcription) so that a slow service ends as a
// recorded failure rather than a killed function.
export const maxDuration = 60;

const kindLabels: Record<string, string> = {
  LAB_REPORT: "Lab report",
  PRESCRIPTION: "Prescription",
  IMAGING: "Imaging",
  VACCINATION_CERT: "Vaccination certificate",
  CONSULTATION_SNAPSHOT: "Snapshot",
  OTHER: "Other",
};

/**
 * Where the vet lands when a consultation ends.
 *
 * Leaving a call used to drop the vet back on their schedule, which is
 * the wrong place — the moment the call ends is exactly when they need
 * the records, the snapshots they just took, and somewhere to write up
 * what happened. Access persists after the appointment because reviewing
 * a case you treated is a normal part of treating it.
 */
export default async function ConsultationReviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await getCurrentUser();

  const appointment = await prisma.appointment.findFirst({
    where: { id, vetProfile: { userId: user.id } },
    include: {
      pet: { select: { id: true, name: true, species: { select: { name: true } } } },
      owner: { select: { name: true } },
      recording: true,
      documents: { orderBy: { createdAt: "desc" } },
      note: {
        include: {
          prescriptions: { orderBy: { createdAt: "asc" } },
          amendments: {
            orderBy: { createdAt: "asc" },
            include: { author: { select: { name: true } } },
          },
        },
      },
    },
  });

  if (!appointment) notFound();

  const patient = await getPatientSummary(appointment.pet.id, user.id);

  const recording = appointment.recording;
  const stalled = recording ? isTranscriptionStale(recording) : false;
  const proposal = (recording?.extraction as Proposal | null) ?? null;
  const note = appointment.note;
  const status = getReviewStatus({
    noteStatus: note?.status ?? null,
    assessment: note?.assessment ?? null,
    recordingStatus: recording?.status ?? null,
    recordingStalled: stalled,
  });

  return (
    <main className="mx-auto max-w-6xl px-6 py-8">
      <Link href="/vet/appointments" className="text-sm text-ink-soft hover:underline">
        Back to schedule
      </Link>

      <header className="mb-6 mt-3">
        <h1 className="text-2xl text-navy-900">
          {appointment.pet.name}
          <span className="text-base font-normal text-ink-soft">
            {" "}
            · {appointment.pet.species.name}
          </span>
        </h1>
        <p className="text-sm text-ink-soft">
          Consultation on{" "}
          <LocalTime date={appointment.startsAt.toISOString()} format="dayTime" />
          {appointment.owner.name && ` · owner: ${appointment.owner.name}`}
        </p>
      </header>

      <div className="mb-6 grid gap-4">
        <ReviewStatusStrip status={status} hasRecording={Boolean(recording)} />
        <IntakeSummary
          intake={intakeFromAppointment(appointment)}
          petName={appointment.pet.name}
          species={appointment.pet.species.name}
          ownerName={appointment.owner.name}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_24rem]">
        <NoteEditor
          appointmentId={appointment.id}
          petName={appointment.pet.name}
          ownerName={appointment.owner.name}
          ownerConcern={appointment.reason}
          suggestedMedications={recording?.status === "TRANSCRIBED" ? (proposal?.medications ?? []) : []}
          transcribing={status === "TRANSCRIBING"}
          note={{
            status: note?.status ?? "DRAFT",
            scratch: note?.scratch ?? null,
            presentingComplaint: note?.presentingComplaint ?? null,
            examination: note?.examination ?? null,
            assessment: note?.assessment ?? null,
            plan: note?.plan ?? null,
            followUpOn: note?.followUpOn?.toISOString().slice(0, 10) ?? null,
            followUpNote: note?.followUpNote ?? null,
            finalisedAt: note?.finalisedAt?.toISOString() ?? null,
            prescriptions:
              note?.prescriptions.map((p) => ({
                id: p.id,
                drug: p.drug,
                dose: p.dose,
                frequency: p.frequency,
                durationDays: p.durationDays,
                instructions: p.instructions,
              })) ?? [],
            amendments:
              note?.amendments.map((a) => ({
                id: a.id,
                body: a.body,
                createdAt: a.createdAt.toISOString().slice(0, 16).replace("T", " "),
                authorName: a.author.name,
              })) ?? [],
          }}
        />

        {/* The AI output sits beside the record it feeds, not above it:
            the vet reads a suggestion and the field it would go into in
            one glance. */}
        <aside className="grid h-fit gap-6">
          <TranscriptPanel
            appointmentId={appointment.id}
            noteLocked={note?.status === "FINALISED"}
            recording={
              recording
                ? {
                    status: recording.status,
                    stalled,
                    durationSeconds: recording.durationSeconds,
                    transcript: recording.transcript,
                    extraction: proposal,
                    error: recording.error,
                  }
                : null
            }
          />

          <section className="rounded-lg border border-mist p-5">
            <h2 className="mb-4 font-medium">From this consultation</h2>
            {appointment.documents.length === 0 ? (
              <p className="text-sm text-ink-faint">
                No snapshots or documents were captured during this call.
              </p>
            ) : (
              <ul className="grid gap-3">
                {appointment.documents.map((d) => (
                  <li key={d.id} className="rounded-md border border-mist p-3">
                    <a
                      href={`/api/documents/${d.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm font-medium hover:underline"
                    >
                      {d.title}
                    </a>
                    <p className="text-xs text-ink-soft">
                      {kindLabels[d.kind] ?? d.kind}
                      {" · "}
                      <LocalTime date={d.createdAt.toISOString()} format="time" />
                    </p>
                    {d.note && <p className="mt-1 text-xs text-ink-soft">{d.note}</p>}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <div className="overflow-hidden rounded-lg border border-mist">
            <PatientPanel patient={patient} />
          </div>
        </aside>
      </div>
    </main>
  );
}
