import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/current-user";
import { getPatientSummary } from "@/lib/patient-summary";
import PatientPanel from "@/components/patient-panel";

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
      documents: { orderBy: { createdAt: "desc" } },
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
        <div>
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

          <p className="mt-4 text-sm text-gray-500">
            Consultation notes and prescriptions will appear here next.
          </p>
        </div>

        <aside className="h-fit overflow-hidden rounded-lg border border-gray-200">
          <PatientPanel patient={patient} />
        </aside>
      </div>
    </main>
  );
}
