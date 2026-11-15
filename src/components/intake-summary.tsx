import {
  DURATION_LABELS,
  URGENCY_LABELS,
  hasIntake,
  type VisitIntake,
  type VisitUrgency,
} from "@/lib/visit-intake";
import StatusPill, { type StatusTone } from "@/components/status-pill";
import type { IconName } from "@/components/icon";

const urgencyPill: Record<VisitUrgency, { tone: StatusTone; icon: IconName }> = {
  ROUTINE: { tone: "neutral", icon: "info" },
  SOON: { tone: "warning", icon: "clock" },
  URGENT: { tone: "danger", icon: "alert" },
};

export function UrgencyBadge({ urgency }: { urgency: VisitUrgency | null }) {
  if (!urgency) return null;
  return (
    <StatusPill tone={urgencyPill[urgency].tone} icon={urgencyPill[urgency].icon}>
      {URGENCY_LABELS[urgency]}
    </StatusPill>
  );
}

/**
 * The owner's pre-visit brief, read-only.
 *
 * Shown to the vet in the call and on the review page, so the consult
 * starts from what the owner already said. The owner sees it in the call
 * too, as a reminder of what they told the vet.
 */
export default function IntakeSummary({
  intake,
  petName,
  species,
  ownerName,
  heading = "Pre-visit brief",
}: {
  intake: VisitIntake;
  petName: string;
  species?: string | null;
  ownerName?: string | null;
  heading?: string;
}) {
  const urgent = intake.urgency === "URGENT";

  return (
    <section
      aria-label={heading}
      className={`rounded-lg border p-4 sm:p-5 ${
        urgent ? "border-red-200 bg-red-50/40" : "border-aqua-100 bg-aqua-50"
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-navy-700">
          {heading}
        </h2>
        <p className="text-xs text-ink-soft">
          For <span className="font-medium text-ink">{petName}</span>
          {species && ` · ${species}`}
          {ownerName && ` · from ${ownerName}`}
        </p>
      </div>

      {!hasIntake(intake) ? (
        <p className="mt-2 text-sm text-ink-faint">
          No brief was given when this appointment was booked.
        </p>
      ) : (
        <>
          <p className="mt-2 whitespace-pre-wrap text-base text-ink">
            {intake.concern ?? <span className="text-ink-faint">No concern described.</span>}
          </p>

          <dl className="mt-3 flex flex-wrap gap-x-6 gap-y-2 text-sm">
            <div className="flex items-center gap-2">
              <dt className="text-xs text-ink-soft">Duration</dt>
              <dd className="font-medium">
                {intake.duration ? DURATION_LABELS[intake.duration] : "—"}
              </dd>
            </div>
            <div className="flex items-center gap-2">
              <dt className="text-xs text-ink-soft">Urgency</dt>
              <dd>
                {intake.urgency ? (
                  <UrgencyBadge urgency={intake.urgency} />
                ) : (
                  <span className="text-ink-faint">Not given</span>
                )}
              </dd>
            </div>
          </dl>

          {intake.notes && (
            <div className="mt-3 border-t border-aqua-100 pt-3">
              <p className="text-xs text-ink-soft">Owner&apos;s notes</p>
              <p className="mt-0.5 whitespace-pre-wrap text-sm text-ink">{intake.notes}</p>
            </div>
          )}
        </>
      )}
    </section>
  );
}
