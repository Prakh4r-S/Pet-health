import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireVetProfile } from "@/lib/current-user";
import {
  getJoinWindow,
  liveEndsAtCutoff,
  JOIN_WINDOW_BEFORE_MINUTES,
} from "@/lib/consultation-room";
import LocalTime from "@/components/local-time";
import ActionForm from "@/components/action-form";
import SubmitButton from "@/components/submit-button";

import { cancelAppointment } from "@/app/appointments/actions";

const PAST_LIMIT = 50;

/** Where the write-up stands, which is what a vet scanning this list needs. */
function recordStatus(
  status: string,
  note: { status: string } | null,
): { text: string; className: string } {
  if (status === "CANCELLED") return { text: "Cancelled", className: "bg-red-50 text-red-700" };
  if (note?.status === "FINALISED") {
    return { text: "Record finalised", className: "bg-green-100 text-green-800" };
  }
  if (note) return { text: "Draft record", className: "bg-amber-100 text-amber-800" };
  return { text: "No record yet", className: "bg-gray-100 text-gray-700" };
}

export default async function VetAppointmentsPage() {
  const { profile } = await requireVetProfile();

  const now = new Date();
  const cutoff = liveEndsAtCutoff(now);

  const pet = {
    include: {
      species: { select: { name: true } },
      breed: { select: { name: true } },
      owner: { select: { name: true } },
    },
  } as const;

  // An appointment stays on the schedule until its room closes, not until
  // its start time passes — otherwise it disappears just as the call
  // begins. Everything after that moves to past consultations, which is
  // the only route back to the review page once a call is over.
  const [current, past] = await Promise.all([
    prisma.appointment.findMany({
      where: { vetProfileId: profile.id, status: "SCHEDULED", endsAt: { gte: cutoff } },
      include: { pet },
      orderBy: { startsAt: "asc" },
    }),
    prisma.appointment.findMany({
      where: {
        vetProfileId: profile.id,
        OR: [{ status: { not: "SCHEDULED" } }, { endsAt: { lt: cutoff } }],
      },
      include: { pet, note: { select: { status: true } } },
      orderBy: { startsAt: "desc" },
      take: PAST_LIMIT,
    }),
  ]);

  return (
    <main className="mx-auto max-w-2xl px-6 py-10">
      <div className="mb-8 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Your schedule</h1>
        <Link href="/vet/availability" className="text-sm text-gray-500 hover:underline">
          Availability
        </Link>
      </div>

      {current.length === 0 ? (
        <p className="rounded-md border border-dashed border-gray-300 p-8 text-center text-sm text-gray-500">
          No upcoming appointments.
        </p>
      ) : (
        <ul className="grid gap-3">
          {current.map((a) => {
            const { opensAt } = getJoinWindow(a);
            const open = now >= opensAt;
            const started = now >= a.startsAt;

            return (
              <li
                key={a.id}
                className="flex items-start justify-between gap-4 rounded-lg border border-gray-200 p-4"
              >
                <div>
                  <p className="font-medium">
                    <LocalTime date={a.startsAt.toISOString()} />
                    {started && (
                      <span className="ml-2 rounded-full bg-green-100 px-2 py-0.5 text-xs font-normal text-green-800">
                        In progress
                      </span>
                    )}
                  </p>
                  <p className="text-sm text-gray-600">
                    {a.pet.name} · {a.pet.species.name}
                    {a.pet.breed && ` · ${a.pet.breed.name}`}
                  </p>
                  <p className="text-xs text-gray-500">Owner: {a.pet.owner.name ?? "—"}</p>
                  {a.reason && <p className="mt-2 text-sm text-gray-700">{a.reason}</p>}
                </div>
                <div className="flex shrink-0 flex-col items-end gap-2">
                  {open ? (
                    <Link
                      href={`/appointments/${a.id}/room`}
                      className="rounded-md bg-pine-900 px-3 py-1.5 text-sm text-white hover:bg-pine-700"
                    >
                      Join call
                    </Link>
                  ) : (
                    <span className="text-xs text-gray-500">
                      Call opens {JOIN_WINDOW_BEFORE_MINUTES} minutes before
                    </span>
                  )}
                  <Link
                    href={`/appointments/${a.id}/review`}
                    className="text-sm text-gray-600 hover:underline"
                  >
                    Review
                  </Link>
                  {!started && (
                    <ActionForm
                      action={cancelAppointment}
                      className="text-right"
                      confirm="Cancel this appointment? The slot will be released."
                    >
                      <input type="hidden" name="id" value={a.id} />
                      <SubmitButton
                        pendingLabel="Cancelling..."
                        className="text-sm text-red-600 hover:underline"
                      >
                        Cancel
                      </SubmitButton>
                    </ActionForm>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <section className="mt-10">
        <h2 className="mb-3 text-sm font-medium text-gray-500">Past consultations</h2>

        {past.length === 0 ? (
          <p className="text-sm text-gray-400">None yet.</p>
        ) : (
          <ul className="grid gap-2">
            {past.map((a) => {
              const record = recordStatus(a.status, a.note);
              const cancelled = a.status === "CANCELLED";
              const finalised = a.note?.status === "FINALISED";

              return (
                <li
                  key={a.id}
                  className="flex items-start justify-between gap-4 rounded-md border border-gray-100 p-3"
                >
                  <div className="text-sm">
                    <p>
                      <span className="text-gray-500">
                        <LocalTime date={a.startsAt.toISOString()} />
                      </span>
                      {" · "}
                      {a.pet.name} · {a.pet.species.name}
                    </p>
                    <p className="text-xs text-gray-500">Owner: {a.pet.owner.name ?? "—"}</p>
                    {a.reason && <p className="mt-0.5 text-xs text-gray-500">{a.reason}</p>}
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1.5">
                    <span className={`rounded-full px-2 py-0.5 text-xs ${record.className}`}>
                      {record.text}
                    </span>
                    {/* A cancelled appointment confers no access to the
                        patient's records, so there is nothing to review. */}
                    {!cancelled && (
                      <Link
                        href={`/appointments/${a.id}/review`}
                        className="text-sm text-pine-700 hover:underline"
                      >
                        {finalised ? "Review" : "Write up"}
                      </Link>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        {past.length === PAST_LIMIT && (
          <p className="mt-3 text-xs text-gray-500">Showing the {PAST_LIMIT} most recent.</p>
        )}
      </section>
    </main>
  );
}
