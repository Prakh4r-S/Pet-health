"use client";

import type { PatientSummary } from "@/lib/patient-summary";
import LocalTime from "@/components/local-time";
import StatusPill, { VACCINE_PILL } from "@/components/status-pill";

const kindLabels: Record<string, string> = {
  LAB_REPORT: "Lab report",
  PRESCRIPTION: "Prescription",
  IMAGING: "Imaging",
  VACCINATION_CERT: "Vaccination cert",
  CONSULTATION_SNAPSHOT: "Snapshot",
  OTHER: "Other",
};

function describeAge(months: number | null, approx: boolean) {
  if (months === null) return "Age unknown";
  const years = Math.floor(months / 12);
  const rest = months % 12;
  const text = years === 0 ? `${rest} mo` : rest === 0 ? `${years} yr` : `${years} yr ${rest} mo`;
  return approx ? `~${text}` : text;
}

function trend(weights: PatientSummary["weights"]) {
  if (weights.length < 2) return null;
  const first = weights[0].weightKg;
  const last = weights[weights.length - 1].weightKg;
  const change = last - first;
  if (Math.abs(change) < 0.05) return "stable";
  const pct = Math.round((change / first) * 100);
  return `${change > 0 ? "+" : ""}${change.toFixed(1)} kg (${pct > 0 ? "+" : ""}${pct}%)`;
}

export default function PatientPanel({ patient }: { patient: PatientSummary }) {
  const attention = patient.vaccines.filter(
    (v) => v.isCore && (v.status === "OVERDUE" || v.status === "NEVER_GIVEN"),
  );
  const weightTrend = trend(patient.weights);

  return (
    <div className="flex h-full flex-col overflow-y-auto bg-white">
      <div className="border-b border-mist px-5 py-4">
        <h2 className="font-medium text-navy-900">{patient.name}</h2>
        <p className="text-sm text-ink-soft">
          {patient.species}
          {patient.breed && ` · ${patient.breed}`}
          {" · "}
          {describeAge(patient.ageMonths, patient.ageIsApprox)}
          {patient.sex !== "UNKNOWN" && ` · ${patient.sex.toLowerCase()}`}
          {patient.neutered === true && " · neutered"}
        </p>
      </div>

      <div className="space-y-5 px-5 py-4">
        {/* Allergies first and unmissable — this is the thing that
            changes a prescribing decision. */}
        {patient.allergies.length > 0 && (
          <section className="rounded-md border border-red-200 bg-red-50 p-3">
            <h3 className="font-sans text-xs font-semibold uppercase tracking-wide text-red-900">
              Allergies
            </h3>
            <ul className="mt-1.5 space-y-1">
              {patient.allergies.map((a, i) => (
                <li key={i} className="text-sm text-red-900">
                  {a.allergen}
                  {a.reaction && <span className="text-red-700"> — {a.reaction}</span>}
                </li>
              ))}
            </ul>
          </section>
        )}

        {attention.length > 0 && (
          <section className="rounded-md border border-amber-200 bg-amber-50 p-3">
            <h3 className="font-sans text-xs font-semibold uppercase tracking-wide text-amber-900">
              Vaccinations needing attention
            </h3>
            <p className="mt-1 text-sm text-amber-900">
              {attention.map((v) => v.name).join(", ")}
            </p>
          </section>
        )}

        {patient.medications.length > 0 && (
          <section>
            <h3 className="font-sans text-xs font-semibold uppercase tracking-wide text-ink-soft">
              Current medication
            </h3>
            <ul className="mt-1.5 space-y-2">
              {patient.medications.map((m) => (
                <li key={m.prescriptionId} className="text-sm">
                  {m.drug}
                  <span className="text-ink-soft">
                    {" "}
                    · {m.dose} · {m.frequency}
                  </span>
                  {/* Adherence as the owner logged it. Words, not a
                      colour: "0 of 2" has to be readable at a glance
                      during a call. */}
                  {patient.doseLogAvailable && (
                    <span className="block text-xs text-ink-soft">
                      Owner logged {m.givenLast24h}
                      {m.perDay != null && ` of ${m.perDay}`} in the last 24 hours
                      {m.lastGivenAt ? (
                        <>
                          {" "}
                          · last <LocalTime date={m.lastGivenAt} format="dayTime" />
                        </>
                      ) : (
                        " · none logged yet"
                      )}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}

        {patient.documents.length > 0 && (
          <section>
            <h3 className="font-sans text-xs font-semibold uppercase tracking-wide text-ink-soft">
              Documents
            </h3>
            <ul className="mt-1.5 space-y-1">
              {patient.documents.map((d) => (
                <li key={d.id}>
                  {/* Opens in a new tab so the call keeps running — a
                      same-tab navigation would unmount the room. */}
                  <a
                    href={`/api/documents/${d.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm hover:underline"
                  >
                    {d.title}
                  </a>
                  <span className="block text-xs text-ink-soft">
                    {kindLabels[d.kind] ?? d.kind} · {d.createdAt}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section>
          <h3 className="font-sans text-xs font-semibold uppercase tracking-wide text-ink-soft">
            Weight
          </h3>
          <p className="mt-1 text-sm">
            {patient.latestWeightKg != null ? `${patient.latestWeightKg} kg` : "No records"}
            {weightTrend && (
              <span className="text-ink-soft">
                {" "}
                · {weightTrend} over {patient.weights.length} readings
              </span>
            )}
          </p>
        </section>

        {patient.conditions.length > 0 && (
          <section>
            <h3 className="font-sans text-xs font-semibold uppercase tracking-wide text-ink-soft">
              Conditions
            </h3>
            <ul className="mt-1 space-y-1">
              {patient.conditions.map((c, i) => (
                <li key={i} className="text-sm">
                  {c.name}
                  <span className="text-ink-soft">{c.ongoing ? " · ongoing" : " · resolved"}</span>
                  {c.notes && <span className="block text-xs text-ink-soft">{c.notes}</span>}
                </li>
              ))}
            </ul>
          </section>
        )}

        <section>
          <h3 className="font-sans text-xs font-semibold uppercase tracking-wide text-ink-soft">
            Vaccinations
          </h3>
          <ul className="mt-1.5 space-y-1.5">
            {patient.vaccines.map((v, i) => (
              <li key={i} className="flex items-center justify-between gap-2">
                <span className="text-sm">
                  {v.name}
                  {v.lastGivenOn && (
                    <span className="block text-xs text-ink-soft">
                      Last {v.lastGivenOn}
                      {v.nextDueOn && ` · due ${v.nextDueOn}`}
                    </span>
                  )}
                </span>
                <StatusPill
                  tone={VACCINE_PILL[v.status]?.tone ?? "neutral"}
                  icon={VACCINE_PILL[v.status]?.icon}
                >
                  {VACCINE_PILL[v.status]?.label ?? v.status}
                </StatusPill>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
