import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/current-user";
import {
  getJoinWindow,
  liveEndsAtCutoff,
  JOIN_WINDOW_BEFORE_MINUTES,
} from "@/lib/consultation-room";
import LocalTime from "@/components/local-time";
import ConsultationRecordView from "@/components/consultation-record";
import { consultationRecordSelect, toOwnerRecord } from "@/lib/consultation-records";
import ActionForm from "@/components/action-form";
import SubmitButton from "@/components/submit-button";

import { cancelAppointment } from "./actions";
import StatusPill, { type StatusTone } from "@/components/status-pill";
import type { IconName } from "@/components/icon";
import FollowUpThread from "@/components/follow-up-thread";
import Icon from "@/components/icon";
import { getFollowUpThreads } from "@/lib/follow-up";

const card = "rounded-lg border border-mist p-4";

const PAST_LIMIT = 50;

const pastLabels: Record<string, { text: string; tone: StatusTone; icon: IconName }> = {
  COMPLETED: { text: "Completed", tone: "ok", icon: "checkCircle" },
  CANCELLED: { text: "Cancelled", tone: "danger", icon: "cross" },
  NO_SHOW: { text: "Missed", tone: "neutral", icon: "dash" },
  // Still SCHEDULED but the room has closed: the call window is over and
  // the vet has not finalised a record yet.
  SCHEDULED: { text: "Ended", tone: "neutral", icon: "clock" },
};

export default async function AppointmentsPage({
  searchParams,
}: {
  searchParams: Promise<{ rescheduled?: string }>;
}) {
  const user = await getCurrentUser();
  const { rescheduled } = await searchParams;

  const now = new Date();
  const cutoff = liveEndsAtCutoff(now);

  const include = {
    pet: { select: { id: true, name: true } },
    vetProfile: { include: { user: { select: { name: true } } } },
  } as const;

  // "Current" means the room can still be entered, not that the start
  // time is in the future. Filtering on startsAt made an appointment
  // vanish at the moment it began — exactly when the join button is
  // needed, and for anyone running a minute late.
  const [current, past] = await Promise.all([
    prisma.appointment.findMany({
      where: { ownerId: user.id, status: "SCHEDULED", endsAt: { gte: cutoff } },
      include,
      orderBy: { startsAt: "asc" },
    }),
    prisma.appointment.findMany({
      where: {
        ownerId: user.id,
        OR: [{ status: { not: "SCHEDULED" } }, { endsAt: { lt: cutoff } }],
      },
      include: { ...include, note: { select: consultationRecordSelect } },
      orderBy: { startsAt: "desc" },
      take: PAST_LIMIT,
    }),
  ]);

  const followUps = await getFollowUpThreads(past, user.id);

  return (
    <main className="mx-auto max-w-2xl px-6 py-10">
      <div className="mb-8 flex items-center justify-between">
        <h1 className="text-2xl text-navy-900">Appointments</h1>
        <Link
          href="/vets"
          className="rounded-md bg-navy-900 px-4 py-2 text-sm text-white hover:bg-navy-700"
        >
          Book
        </Link>
      </div>

      {rescheduled && (
        <p
          role="status"
          className="mb-4 rounded-md border border-aqua-100 bg-aqua-50 px-4 py-3 text-sm text-navy-900"
        >
          Appointment moved. If you added the old time to your calendar, use
          &ldquo;Add to Calendar&rdquo; again to update it.
        </p>
      )}

      {current.length === 0 ? (
        <p className="rounded-md border border-dashed border-mist-deep p-8 text-center text-sm text-ink-soft">
          Nothing booked.
        </p>
      ) : (
        <ul className="grid gap-3">
          {current.map((a) => {
            const { opensAt } = getJoinWindow(a);
            const open = now >= opensAt;
            const started = now >= a.startsAt;

            return (
              <li key={a.id} className={`${card} flex items-start justify-between gap-4`}>
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
                    {a.pet.name} with {a.vetProfile.user.name ?? "vet"}
                    {a.wasInstantMatch && " · matched automatically"}
                  </p>
                  {a.reason && <p className="mt-1 text-sm text-ink-soft">{a.reason}</p>}
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
                  {/* A plain download: the route builds the .ics file. */}
                  <a
                    href={`/api/appointments/${a.id}/calendar`}
                    download
                    className="text-sm text-navy-700 hover:underline"
                  >
                    Add to Calendar
                  </a>
                  {!started && (
                    <Link
                      href={`/appointments/${a.id}/reschedule`}
                      className="text-sm text-navy-700 hover:underline"
                    >
                      Reschedule
                    </Link>
                  )}
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

      {past.length > 0 && (
        <section className="mt-10">
          <h2 className="mb-3 text-sm font-medium text-ink-soft">Past consultations</h2>
          <ul className="grid gap-2">
            {past.map((a) => {
              const label = pastLabels[a.status];
              // Null unless the vet has finalised it — a draft is not
              // shown, however far along it is.
              const record = toOwnerRecord(a.note);
              const thread = followUps.threads.get(a.id);
              return (
                <li key={a.id} className="rounded-md border border-mist p-3 text-sm">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p>
                        <span className="text-ink-soft">
                          <LocalTime date={a.startsAt.toISOString()} />
                        </span>
                        {" · "}
                        {a.pet.name} with {a.vetProfile.user.name ?? "vet"}
                      </p>
                      {a.reason && <p className="mt-0.5 text-xs text-ink-soft">{a.reason}</p>}
                    </div>
                    {label && (
                      <StatusPill tone={label.tone} icon={label.icon}>
                        {label.text}
                      </StatusPill>
                    )}
                  </div>

                  {/* Open by default while it can still be written to, or
                      once there is something in it to read. */}
                  {thread && (thread.open || thread.messages.length > 0) && (
                    <details className="mt-2" open={thread.open}>
                      <summary className="flex min-h-6 cursor-pointer select-none items-center gap-1.5 text-sm text-navy-700 hover:text-navy-900">
                        <Icon name="message" />
                        Follow-up with {a.vetProfile.user.name ?? "the vet"}
                        {thread.messages.length > 0 && ` · ${thread.messages.length}`}
                        {thread.open && (
                          <StatusPill tone="info" icon="clock" className="ml-1">
                            Open
                          </StatusPill>
                        )}
                      </summary>
                      <div className="mt-3 rounded-md border border-mist bg-white p-4">
                        <FollowUpThread
                          thread={thread}
                          petId={a.pet.id}
                          viewer="owner"
                          otherName={a.vetProfile.user.name ?? "the vet"}
                        />
                      </div>
                    </details>
                  )}

                  {record ? (
                    <details className="mt-2">
                      <summary className="cursor-pointer select-none text-sm text-navy-700 hover:text-navy-900">
                        View the vet&apos;s record
                        {record.prescriptions.length > 0 &&
                          ` · ${record.prescriptions.length} prescribed`}
                      </summary>
                      <div className="mt-3 rounded-md border border-mist p-4">
                        <ConsultationRecordView record={record} />
                      </div>
                    </details>
                  ) : (
                    a.status !== "CANCELLED" && (
                      <p className="mt-1 text-xs text-ink-faint">
                        The vet hasn&apos;t finalised a record for this consultation yet.
                      </p>
                    )
                  )}
                </li>
              );
            })}
          </ul>
          {past.length === PAST_LIMIT && (
            <p className="mt-3 text-xs text-ink-soft">Showing the {PAST_LIMIT} most recent.</p>
          )}
        </section>
      )}
    </main>
  );
}
