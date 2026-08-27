import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/current-user";
import { getRoomAccess } from "@/lib/consultation-room";
import { createJoinToken } from "@/lib/livekit";
import { getPatientSummary } from "@/lib/patient-summary";
import ConsultationWorkspace from "@/components/consultation-workspace";

export const dynamic = "force-dynamic";

function Blocked({ title, body }: { title: string; body: string }) {
  return (
    <main className="mx-auto max-w-lg px-6 py-20 text-center">
      <h1 className="text-xl font-semibold">{title}</h1>
      <p className="mt-2 text-sm text-gray-600">{body}</p>
      <Link
        href="/appointments"
        className="mt-6 inline-block rounded-md bg-gray-900 px-4 py-2 text-sm text-white hover:bg-gray-700"
      >
        Back to appointments
      </Link>
    </main>
  );
}

export default async function ConsultationRoomPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await getCurrentUser();

  const access = await getRoomAccess(id, user.id);

  if (!access.ok) {
    switch (access.reason) {
      case "TOO_EARLY":
        return (
          <Blocked
            title="Not open yet"
            body={`This consultation opens at ${access.opensAt?.toLocaleTimeString(undefined, {
              hour: "2-digit",
              minute: "2-digit",
            })}.`}
          />
        );
      case "ENDED":
        return <Blocked title="Consultation ended" body="This call is no longer open." />;
      case "CANCELLED":
        return <Blocked title="Cancelled" body="This appointment was cancelled." />;
      default:
        return (
          <Blocked title="Not available" body="This consultation isn't available to you." />
        );
    }
  }

  const serverUrl = process.env.NEXT_PUBLIC_LIVEKIT_URL;
  if (!serverUrl) throw new Error("NEXT_PUBLIC_LIVEKIT_URL is not set");

  const appointment = await prisma.appointment.findUniqueOrThrow({
    where: { id },
    include: {
      pet: { select: { id: true, name: true, species: { select: { name: true } } } },
      vetProfile: { include: { user: { select: { name: true } } } },
    },
  });

  const [token, patient] = await Promise.all([
    createJoinToken({
      roomName: access.roomName,
      identity: user.id,
      displayName: access.displayName,
      expiresAt: access.expiresAt,
    }),
    // Only the vet gets the records panel. The owner already has full
    // access to their own pet's history elsewhere and does not need it
    // during the call; fetching it for them would be needless work and a
    // needless place for a leak.
    access.isVet ? getPatientSummary(appointment.pet.id) : Promise.resolve(null),
  ]);

  return (
    <main className="mx-auto max-w-6xl px-6 py-6">
      <div className="mb-4">
        <h1 className="text-lg font-semibold">
          {appointment.pet.name} · {appointment.pet.species.name}
        </h1>
        <p className="text-sm text-gray-600">
          {access.isVet
            ? "Consultation"
            : `With ${appointment.vetProfile.user.name ?? "your vet"}`}
          {appointment.reason && ` · ${appointment.reason}`}
        </p>
      </div>

      <ConsultationWorkspace
        token={token}
        serverUrl={serverUrl}
        onLeaveHref={access.isVet ? "/vet/appointments" : "/appointments"}
        patient={patient}
      />
    </main>
  );
}
