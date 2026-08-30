import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireVetProfile } from "@/lib/current-user";
import { cancelAppointment } from "@/app/appointments/actions";

function when(d: Date) {
  return d.toLocaleString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function VetAppointmentsPage() {
  const { profile } = await requireVetProfile();

  const appointments = await prisma.appointment.findMany({
    where: { vetProfileId: profile.id, status: "SCHEDULED", startsAt: { gte: new Date() } },
    include: {
      pet: {
        include: {
          species: { select: { name: true } },
          breed: { select: { name: true } },
          owner: { select: { name: true } },
        },
      },
    },
    orderBy: { startsAt: "asc" },
  });

  return (
    <main className="mx-auto max-w-2xl px-6 py-10">
      <div className="mb-8 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Your schedule</h1>
        <Link href="/vet/availability" className="text-sm text-gray-500 hover:underline">
          Availability
        </Link>
      </div>

      {appointments.length === 0 ? (
        <p className="rounded-md border border-dashed border-gray-300 p-8 text-center text-sm text-gray-500">
          No upcoming appointments.
        </p>
      ) : (
        <ul className="grid gap-3">
          {appointments.map((a) => (
            <li
              key={a.id}
              className="flex items-start justify-between gap-4 rounded-lg border border-gray-200 p-4"
            >
              <div>
                <p className="font-medium">{when(a.startsAt)}</p>
                <p className="text-sm text-gray-600">
                  {a.pet.name} · {a.pet.species.name}
                  {a.pet.breed && ` · ${a.pet.breed.name}`}
                </p>
                <p className="text-xs text-gray-500">
                  Owner: {a.pet.owner.name ?? "—"}
                </p>
                {a.reason && <p className="mt-2 text-sm text-gray-700">{a.reason}</p>}
              </div>
              <div className="flex flex-col items-end gap-2">
              <Link
                  href={`/appointments/${a.id}/room`}
                  className="rounded-md bg-gray-900 px-3 py-1.5 text-sm text-white hover:bg-gray-700"
                >
                  Join call
                </Link>
                <Link
                  href={`/appointments/${a.id}/review`}
                  className="text-sm text-gray-600 hover:underline"
                >
                  Review
                </Link>
                <form action={cancelAppointment}>
                  <input type="hidden" name="id" value={a.id} />
                  <button type="submit" className="text-sm text-red-600 hover:underline">
                    Cancel
                  </button>
                </form>
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
