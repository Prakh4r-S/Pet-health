import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/current-user";
import { getPatientSummary } from "@/lib/patient-summary";
import PatientPanel from "@/components/patient-panel";
import NoteEditor from "@/components/note-editor";
import TranscriptPanel, { type Proposal } from "@/components/transcript-panel";

export const dynamic = "force-dynamic";

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
      pet: { select: { id: true, name: true } },
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

  const patient = await getPatientSummary(appointment.pet.id);

  return (
    <main className="mx-auto max-w-5xl px-6 py-8">
      <Link href="/vet/appointments" className="text-sm text-gray-500 hover:underline">
        Back to schedule
      </Link>

      <header className="mb-6 mt-3">
        <h1 className="text-2xl font-semibold">{appointment.pet.name}</h1>
        <p className="text-sm text-gray-600">
          Consultation on{" "}
          {appointment.startsAt.toLocaleString(undefined, {
            day: "numeric",
            month: "short",
            hour: "2-digit",
            minute: "2-digit",
          })}
          {appointment.owner.name && ` · owner: ${appointment.owner.name}`}
          {appointment.reason && ` · ${appointment.reason}`}
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        <div className="grid gap-6">
          <section className="rounded-lg border border-gray-200 p-5">
            <h2 className="mb-4 font-medium">From this consultation</h2>
            {appointment.documents.length === 0 ? (
              <p className="text-sm text-gray-400">
                No snapshots or documents were captured during this call.
              </p>
            ) : (
              <ul className="grid gap-3 sm:grid-cols-2">
                {appointment.documents.map((d) => (
                  <li key={d.id} className="rounded-md border border-gray-100 p-3">
                    <a
                      href={`/api/documents/${d.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm font-medium hover:underline"
                    >
                      {d.title}
                    </a>
                    <p className="text-xs text-gray-500">
                      {kindLabels[d.kind] ?? d.kind}
                      {" · "}
                      {d.createdAt.toLocaleTimeString(undefined, {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                    {d.note && <p className="mt-1 text-xs text-gray-600">{d.note}</p>}
                  </li>
                ))}
              </ul>
            )}
          </section>
          <TranscriptPanel
            appointmentId={appointment.id}
            noteLocked={appointment.note?.status === "FINALISED"}
            recording={
              appointment.recording
                ? {
                    status: appointment.recording.status,
                    durationSeconds: appointment.recording.durationSeconds,
                    transcript: appointment.recording.transcript,
                    extraction: (appointment.recording.extraction as Proposal | null) ?? null,
                    error: appointment.recording.error,
                  }
                : null
            }
          />
          <NoteEditor
            appointmentId={appointment.id}
            note={{
              status: appointment.note?.status ?? "DRAFT",
              scratch: appointment.note?.scratch ?? null,
              presentingComplaint: appointment.note?.presentingComplaint ?? null,
              examination: appointment.note?.examination ?? null,
              assessment: appointment.note?.assessment ?? null,
              plan: appointment.note?.plan ?? null,
              followUpOn:
                appointment.note?.followUpOn?.toISOString().slice(0, 10) ?? null,
              finalisedAt: appointment.note?.finalisedAt?.toISOString() ?? null,
              prescriptions:
                appointment.note?.prescriptions.map((p) => ({
                  id: p.id,
                  drug: p.drug,
                  dose: p.dose,
                  frequency: p.frequency,
                  durationDays: p.durationDays,
                  instructions: p.instructions,
                })) ?? [],
              amendments:
                appointment.note?.amendments.map((a) => ({
                  id: a.id,
                  body: a.body,
                  createdAt: a.createdAt.toISOString().slice(0, 16).replace("T", " "),
                  authorName: a.author.name,
                })) ?? [],
            }}
          />
        </div>

        <aside className="h-fit overflow-hidden rounded-lg border border-gray-200">
          <PatientPanel patient={patient} />
        </aside>
      </div>
    </main>
  );
}
