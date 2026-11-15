import Link from "next/link";
import ActionForm from "@/components/action-form";
import SubmitButton from "@/components/submit-button";
import LocalTime from "@/components/local-time";
import { markDoseGiven, undoDose } from "@/app/pets/care-actions";
import type { CareMedication, CareVaccine, PetCare } from "@/lib/care";
import Icon from "@/components/icon";

// Every badge below pairs an icon with words: the colour is a third
// signal, never the only one, so the card reads the same in greyscale
// and to a screen reader.

const badge = "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium";

function VaccineBadge({ vaccine }: { vaccine: CareVaccine }) {
  if (vaccine.status === "OVERDUE") {
    const days = Math.abs(vaccine.daysUntilDue ?? 0);
    return (
      <span className={`${badge} bg-red-50 text-red-900 ring-1 ring-red-200`}>
        <Icon name="alert" />
        Overdue by {days} {days === 1 ? "day" : "days"}
      </span>
    );
  }
  if (vaccine.status === "NEVER_GIVEN") {
    return (
      <span className={`${badge} bg-amber-50 text-amber-900 ring-1 ring-amber-200`}>
        <Icon name="dash" />
        Never given
      </span>
    );
  }
  const days = vaccine.daysUntilDue ?? 0;
  return (
    <span className={`${badge} bg-aqua-50 text-navy-900 ring-1 ring-aqua-100`}>
      <Icon name="clock" />
      {days === 0 ? "Due today" : `Due in ${days} ${days === 1 ? "day" : "days"}`}
    </span>
  );
}

/** "1 of 2 given in the last 24 hours", with the state said in words. */
function DoseBadge({ medication }: { medication: CareMedication }) {
  const { givenLast24h: given, perDay } = medication;
  const done = perDay != null && given >= perDay;

  const text =
    perDay != null
      ? `${given} of ${perDay} given in the last 24 hours`
      : given === 0
        ? "None given in the last 24 hours"
        : `${given} given in the last 24 hours`;

  return (
    <span
      className={`${badge} ${
        done
          ? "bg-aqua-100 text-navy-900"
          : // No doses yet is only worth flagging when some were expected:
            // an "as needed" medicine with none given is not behind.
            given > 0 || perDay == null
            ? "bg-aqua-50 text-navy-900 ring-1 ring-aqua-100"
            : "bg-amber-50 text-amber-900 ring-1 ring-amber-200"
      }`}
    >
      <Icon name={done ? "check" : given > 0 ? "clock" : "dash"} />
      {text}
    </span>
  );
}

function MedicationRow({
  medication,
  canLog,
  showLog,
}: {
  medication: CareMedication;
  canLog: boolean;
  showLog: boolean;
}) {
  return (
    <li className="py-3">
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-sm font-medium">
            <Icon name="pill" className="h-4 w-4 text-aqua-600" />
            {medication.drug}
            <span className="font-normal text-ink-soft">
              {medication.dose} · {medication.frequency}
            </span>
          </p>
          {medication.instructions && (
            <p className="mt-0.5 text-xs text-ink-soft">{medication.instructions}</p>
          )}
          <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-ink-soft">
            <DoseBadge medication={medication} />
            {medication.lastGivenAt && (
              <span>
                Last given <LocalTime date={medication.lastGivenAt} format="dayTime" />
              </span>
            )}
            {medication.until && (
              <span>
                Course ends <LocalTime date={medication.until} format="day" />
              </span>
            )}
          </p>
        </div>

        {canLog && (
          <div className="flex shrink-0 flex-col items-end gap-1">
            <ActionForm action={markDoseGiven}>
              <input type="hidden" name="prescriptionId" value={medication.prescriptionId} />
              <SubmitButton
                pendingLabel="Saving..."
                className="rounded-md bg-navy-900 px-3 py-1.5 text-sm text-white hover:bg-navy-700"
              >
                Mark Given
                <span className="sr-only">: {medication.drug}</span>
              </SubmitButton>
            </ActionForm>
            {medication.undoableDoseId && (
              <ActionForm action={undoDose}>
                <input type="hidden" name="doseId" value={medication.undoableDoseId} />
                <SubmitButton
                  pendingLabel="Undoing..."
                  className="text-xs text-ink-soft underline hover:text-ink"
                >
                  Undo last entry
                </SubmitButton>
              </ActionForm>
            )}
          </div>
        )}
      </div>

      {showLog && (
        <details className="mt-2">
          <summary className="cursor-pointer select-none text-xs text-navy-700 hover:text-navy-900">
            Dose log ({medication.recentDoses.length}
            {medication.recentDoses.length === 14 ? "+" : ""})
          </summary>
          {medication.recentDoses.length === 0 ? (
            <p className="mt-1 text-xs text-ink-faint">No doses logged yet.</p>
          ) : (
            <ul className="mt-1 grid gap-0.5 text-xs text-ink-soft sm:grid-cols-2">
              {medication.recentDoses.map((d) => (
                <li key={d.id} className="flex items-center gap-1">
                  <Icon name="check" className="h-3 w-3" />
                  <LocalTime date={d.givenAt} format="dayTime" />
                </li>
              ))}
            </ul>
          )}
        </details>
      )}
    </li>
  );
}

/**
 * What needs doing for one or more pets: medicines to give, with a
 * button to say one was given, and vaccinations that are overdue or
 * coming up.
 *
 * `mode="owner"` is the to-do list. `mode="vet"` is the same information
 * read-only, with each medicine's dose log open to inspection — the vet
 * is checking whether the course is being followed, not following it.
 */
export default function CareSummary({
  pets,
  mode,
  showPetNames,
  doseLogAvailable,
  className = "",
}: {
  pets: PetCare[];
  mode: "owner" | "vet";
  /** On the dashboard, where several pets share the card. */
  showPetNames: boolean;
  doseLogAvailable: boolean;
  className?: string;
}) {
  const withCare = pets.filter((p) => p.medications.length > 0 || p.vaccines.length > 0);
  const canLog = mode === "owner" && doseLogAvailable;

  return (
    <section
      aria-labelledby="care-summary"
      className={`rounded-lg border border-mist bg-white p-5 ${className}`}
    >
      <h2 id="care-summary" className="font-medium">
        {mode === "owner" ? "Today's Care & Upcoming Due" : "Medication adherence & vaccinations due"}
      </h2>
      {mode === "vet" && (
        <p className="mt-0.5 text-xs text-ink-soft">
          Doses are logged by the owner as they give them. Read-only.
        </p>
      )}

      {withCare.length === 0 ? (
        <p className="mt-3 flex items-center gap-1.5 text-sm text-ink-soft">
          <Icon name="check" className="h-4 w-4 text-aqua-600" />
          {mode === "owner"
            ? "Nothing due. No active medication, and vaccinations are up to date."
            : "No active medication, and no vaccinations due."}
        </p>
      ) : (
        <div className="mt-2 divide-y divide-mist">
          {withCare.map((pet) => (
            <div key={pet.petId} className="py-2">
              {showPetNames && (
                <h3 className="mt-1 font-sans text-sm font-semibold text-navy-900">
                  <Link href={`/pets/${pet.petId}`} className="hover:underline">
                    {pet.petName}
                  </Link>
                </h3>
              )}

              {pet.medications.length > 0 && (
                <ul className="divide-y divide-mist/70">
                  {pet.medications.map((m) => (
                    <MedicationRow
                      key={m.prescriptionId}
                      medication={m}
                      canLog={canLog}
                      showLog={mode === "vet" && doseLogAvailable}
                    />
                  ))}
                </ul>
              )}

              {pet.vaccines.length > 0 && (
                <ul className="grid gap-2 py-2">
                  {pet.vaccines.map((v) => (
                    <li
                      key={v.name}
                      className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-sm"
                    >
                      <span className="flex items-center gap-1.5">
                        <Icon name="syringe" className="h-4 w-4 text-aqua-600" />
                        {v.name} vaccination
                        {v.isCore && <span className="text-xs text-ink-soft">core</span>}
                      </span>
                      <VaccineBadge vaccine={v} />
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
