import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/current-user";
import { cancelAppointment } from "./actions";

const card = "rounded-lg border border-gray-200 p-4";

function when(d: Date) {
  return d.toLocaleString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function AppointmentsPage() {
  const user = await getCurrentUser();

  const appointments = await prisma.appointment.findMany({
    where: { ownerId: user.id },
    include: {
      pet: { select: { name: true } },
      vetProfile: { include: { user: { select: { name: true } } } },
    },
    orderBy: { startsAt: "asc" },
  });

  const now = new Date();
  const upcoming = appointments.filter(
    (a) => a.status === "SCHEDULED" && a.startsAt >= now,
  );
  const past = appointments.filter(
    (a) => a.status !== "SCHEDULED" || a.startsAt < now,
  );

  return (
    <main className="mx-auto max-w-2xl px-6 py-10">
      <div className="mb-8 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Appointments</h1>
        <Link
          href="/vets"
          className="rounded-md bg-pine-900 px-4 py-2 text-sm text-white hover:bg-pine-700"
        >
          Book
        </Link>
      </div>

      {upcoming.length === 0 ? (
        <p className="rounded-md border border-dashed border-gray-300 p-8 text-center text-sm text-gray-500">
          Nothing booked.
        </p>
      ) : (
        <ul className="grid gap-3">
          {upcoming.map((a) => (
            <li key={a.id} className={`${card} flex items-start justify-between gap-4`}>
              <div>
                <p className="font-medium">{when(a.startsAt)}</p>
                <p className="text-sm text-gray-600">
                  {a.pet.name} with {a.vetProfile.user.name ?? "vet"}
                  {a.wasInstantMatch && " · matched automatically"}
                </p>
                {a.reason && <p className="mt-1 text-sm text-gray-500">{a.reason}</p>}
              </div>
                            <div className="flex shrink-0 flex-col items-end gap-2">
                <Link
                  href={`/appointments/${a.id}/room`}
                  className="rounded-md bg-pine-900 px-3 py-1.5 text-sm text-white hover:bg-pine-700"
                >
                  Join call
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

      {past.length > 0 && (
        <section className="mt-10">
          <h2 className="mb-3 text-sm font-medium text-gray-500">Past and cancelled</h2>
          <ul className="grid gap-2">
            {past.map((a) => (
              <li key={a.id} className="rounded-md border border-gray-100 p-3 text-sm">
                <span className="text-gray-500">{when(a.startsAt)}</span>
                {" · "}
                {a.pet.name} with {a.vetProfile.user.name ?? "vet"}
                {a.status === "CANCELLED" && (
                  <span className="ml-2 text-xs text-red-600">cancelled</span>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
