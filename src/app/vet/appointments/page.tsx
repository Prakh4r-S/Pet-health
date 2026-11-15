import Link from "next/link";
import { UrgencyBadge } from "@/components/intake-summary";
import { DURATION_LABELS } from "@/lib/visit-intake";
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
import StatusPill, { type StatusTone } from "@/components/status-pill";
import type { IconName } from "@/components/icon";
import { getFollowUpThreads } from "@/lib/follow-up";

const PAST_LIMIT = 50;

/** Where the write-up stands, which is what a vet scanning this list needs. */
function recordStatus(
  status: string,
  note: { status: string } | null,
): { text: string; tone: StatusTone; icon: IconName } {
  if (status === "CANCELLED") return { text: "Cancelled", tone: "danger", icon: "cross" };
  if (note?.status === "FINALISED") {
    return { text: "Record finalised", tone: "ok", icon: "lock" };
  }
  if (note) return { text: "Draft record", tone: "warning", icon: "pencil" };
  return { text: "No record yet", tone: "neutral", icon: "dash" };
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
      include: { pet, note: { select: { status: true, finalisedAt: true } } },
      orderBy: { startsAt: "desc" },
      take: PAST_LIMIT,
    }),
  ]);

  const followUps = await getFollowUpThreads(
    past.map((a) => ({ ...a, vetProfile: { userId: profile.userId } })),
    profile.userId,
  );

  return (
    <main className="mx-auto max-w-2xl px-6 py-10">
      <div className="mb-8 flex items-center justify-between">
        <h1 className="text-2xl text-navy-900">Your schedule</h1>
        <Link href="/vet/availability" className="text-sm text-ink-soft hover:underline">
          Availability
        </Link>
      </div>

      {current.length === 0 ? (
        <p className="rounded-md border border-dashed border-mist-deep p-8 text-center text-sm text-ink-soft">
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
                className="flex items-start justify-between gap-4 rounded-lg border border-mist p-4"
              >
                <div>
                  <p className="font-medium">
                    <LocalTime date={a.startsAt.toISOString()} />
                    {started && (
                      <StatusPill tone="ok" icon="live" className="ml-2 align-middle">
                        In progress
                      </StatusPill>
                    )}
                  </p>
                  <p className="text-sm text-ink-soft">
                    {a.pet.name} · {a.pet.species.name}
                    {a.pet.breed && ` · ${a.pet.breed.name}`}
                  </p>
                  <p className="text-xs text-ink-soft">Owner: {a.pet.owner.name ?? "—"}</p>
                  {(a.urgency || a.symptomDuration) && (
                    <p className="mt-2 flex flex-wrap items-center gap-2 text-xs text-ink-soft">
                      <UrgencyBadge urgency={a.urgency} />
                      {a.symptomDuration && (
                        <span>Going on for {DURATION_LABELS[a.symptomDuration].toLowerCase()}</span>
                      )}
                    </p>
                  )}
                  {a.reason && <p className="mt-2 text-sm text-ink">{a.reason}</p>}
                </div>
                <div className="flex shrink-0 flex-col items-end gap-2">
                  {open ? (
                    <Link
                      href={`/appointments/${a.id}/room`}
                      className="rounded-md bg-navy-900 px-3 py-1.5 text-sm text-white hover:bg-navy-700"
                    >
                      Join call
                    </Link>
                  ) : (
                    <span className="text-xs text-ink-soft">
                      Call opens {JOIN_WINDOW_BEFORE_MINUTES} minutes before
                    </span>
                  )}
                  <Link
                    href={`/appointments/${a.id}/review`}
                    className="text-sm text-ink-soft hover:underline"
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
                        className="text-sm text-red-700 hover:underline"
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
        <h2 className="mb-3 text-sm font-medium text-ink-soft">Past consultations</h2>

        {past.length === 0 ? (
          <p className="text-sm text-ink-faint">None yet.</p>
        ) : (
          <ul className="grid gap-2">
            {past.map((a) => {
              const record = recordStatus(a.status, a.note);
              const cancelled = a.status === "CANCELLED";
              const finalised = a.note?.status === "FINALISED";
              // The owner spoke last: there is a question waiting.
              const lastMessage = followUps.threads.get(a.id)?.messages.at(-1);
              const awaitingReply = lastMessage ? !lastMessage.fromVet : false;

              return (
                <li
                  key={a.id}
                  className="flex items-start justify-between gap-4 rounded-md border border-mist p-3"
                >
                  <div className="text-sm">
                    <p>
                      <span className="text-ink-soft">
                        <LocalTime date={a.startsAt.toISOString()} />
                      </span>
                      {" · "}
                      {a.pet.name} · {a.pet.species.name}
                    </p>
                    <p className="text-xs text-ink-soft">Owner: {a.pet.owner.name ?? "—"}</p>
                    {a.reason && <p className="mt-0.5 text-xs text-ink-soft">{a.reason}</p>}
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1.5">
                    <StatusPill tone={record.tone} icon={record.icon}>{record.text}</StatusPill>
                    {awaitingReply && (
                      <StatusPill tone="warning" icon="message">
                        Follow-up question
                      </StatusPill>
                    )}
                    {/* A cancelled appointment confers no access to the
                        patient's records, so there is nothing to review. */}
                    {!cancelled && (
                      <Link
                        href={`/appointments/${a.id}/review`}
                        className="text-sm text-navy-700 hover:underline"
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
          <p className="mt-3 text-xs text-ink-soft">Showing the {PAST_LIMIT} most recent.</p>
        )}
      </section>
    </main>
  );
}
