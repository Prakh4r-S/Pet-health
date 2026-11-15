import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPassportView } from "@/lib/passport";
import PetAvatar from "@/components/pet-avatar";
import StatusPill, { SEVERITY_PILL, VACCINE_PILL } from "@/components/status-pill";

export const dynamic = "force-dynamic";

/**
 * Kept out of search engines, and out of the Referer header.
 *
 * The address of this page is its key. `no-referrer` stops the browser
 * handing that address to whatever site a visitor clicks through to
 * next; `noindex` stops a crawler that stumbles on a shared link from
 * listing it.
 */
export const metadata: Metadata = {
  title: "Health passport · Max Petcare",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

function describeAge(months: number | null, approx: boolean) {
  if (months === null) return null;
  const years = Math.floor(months / 12);
  const rest = months % 12;
  const text =
    years === 0 ? `${rest} mo` : rest === 0 ? `${years} yr` : `${years} yr ${rest} mo`;
  return approx ? `about ${text}` : text;
}

function Fact({
  label,
  value,
  className,
}: {
  label: string;
  value: string | null;
  /** On the group itself: a <dl> may hold only one wrapper around each pair. */
  className?: string;
}) {
  return (
    <div className={className}>
      <dt className="text-xs text-ink-soft">{label}</dt>
      <dd className="mt-0.5 text-sm font-medium">{value ?? "Not recorded"}</dd>
    </div>
  );
}

/**
 * A pet's critical health information, readable by anyone with the link.
 *
 * There is no sign-in here by design: the person reading this is a
 * sitter with a sick animal, or a vet at an emergency clinic who has
 * never heard of this app. What they are allowed to see is decided
 * entirely by getPassportView, which selects the fields one by one.
 *
 * Laid out for a phone, in the order someone in a hurry needs it: what
 * will hurt this animal, what it is being given, who to call, then the
 * rest. A wrong or revoked link gets the same "not found" as a page that
 * never existed.
 */
export default async function PassportPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const pet = await getPassportView(token);
  if (!pet) notFound();

  const age = describeAge(pet.ageMonths, pet.birthDateIsApprox);

  return (
    <main className="mx-auto max-w-xl px-5 py-8">
      <div className="flex items-center gap-4">
        <PetAvatar
          name={pet.name}
          speciesSlug={pet.speciesSlug}
          photoUrl={pet.photoUrl}
          size="lg"
        />
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-aqua-600">
            Health passport
          </p>
          <h1 className="mt-1 text-3xl text-navy-900">{pet.name}</h1>
          <p className="mt-1 text-ink-soft">
            {pet.species}
            {pet.breed && ` · ${pet.breed}`}
            {age && ` · ${age}`}
          </p>
        </div>
      </div>

      {/* Allergies first and unmissable: this is what changes what a
          stranger may safely give the animal. Stated even when empty —
          "none recorded" is information, a missing section is not. */}
      <section
        aria-labelledby="allergies"
        className={`mt-6 rounded-lg border p-4 ${
          pet.allergies.length > 0 ? "border-red-200 bg-red-50" : "border-mist bg-aqua-50"
        }`}
      >
        <h2
          id="allergies"
          className={`font-sans text-xs font-semibold uppercase tracking-wide ${
            pet.allergies.length > 0 ? "text-red-900" : "text-ink-soft"
          }`}
        >
          Allergies
        </h2>
        {pet.allergies.length === 0 ? (
          <p className="mt-1 text-sm text-ink-soft">None recorded.</p>
        ) : (
          <ul className="mt-2 grid gap-2">
            {pet.allergies.map((a, i) => (
              <li key={i} className="text-red-900">
                <span className="font-semibold">{a.allergen}</span>
                {SEVERITY_PILL[a.severity] && (
                  <StatusPill
                    tone={SEVERITY_PILL[a.severity].tone}
                    icon={SEVERITY_PILL[a.severity].icon}
                    className="ml-2 align-middle"
                  >
                    {SEVERITY_PILL[a.severity].label}
                  </StatusPill>
                )}
                {a.reaction && <p className="text-sm text-red-800">{a.reaction}</p>}
              </li>
            ))}
          </ul>
        )}
      </section>

      {pet.conditions.length > 0 && (
        <section
          aria-labelledby="conditions"
          className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-4"
        >
          <h2
            id="conditions"
            className="font-sans text-xs font-semibold uppercase tracking-wide text-amber-900"
          >
            Ongoing conditions
          </h2>
          <ul className="mt-2 grid gap-2">
            {pet.conditions.map((c, i) => (
              <li key={i} className="text-amber-900">
                <span className="font-semibold">{c.name}</span>
                {c.diagnosedOn && (
                  <span className="text-sm"> · diagnosed {c.diagnosedOn}</span>
                )}
                {c.notes && <p className="whitespace-pre-wrap text-sm">{c.notes}</p>}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-labelledby="medication" className="mt-6">
        <h2 id="medication" className="text-lg text-navy-900">
          Current medication
        </h2>
        {pet.prescriptions.length === 0 ? (
          <p className="mt-1 text-sm text-ink-soft">
            No current prescriptions on record.
          </p>
        ) : (
          <ul className="mt-2 grid gap-2">
            {pet.prescriptions.map((p, i) => (
              <li key={i} className="rounded-md bg-aqua-50 px-3 py-2.5">
                <p className="font-medium">{p.drug}</p>
                <p className="text-sm">
                  {p.dose} · {p.frequency}
                </p>
                {p.instructions && (
                  <p className="mt-0.5 text-sm text-ink-soft">{p.instructions}</p>
                )}
                <p className="mt-1 text-xs text-ink-soft">
                  Prescribed {p.prescribedOn}
                  {p.until ? ` · course ends ${p.until}` : " · no end date given"}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      {(pet.ownerName || pet.contactNote) && (
        <section
          aria-labelledby="owner"
          className="mt-6 rounded-lg border border-mist p-4"
        >
          <h2
            id="owner"
            className="font-sans text-xs font-semibold uppercase tracking-wide text-ink-soft"
          >
            Owner
          </h2>
          {pet.ownerName && <p className="mt-1 font-medium">{pet.ownerName}</p>}
          {pet.contactNote && (
            <p className="mt-1 whitespace-pre-wrap text-sm">{pet.contactNote}</p>
          )}
        </section>
      )}

      <section aria-labelledby="details" className="mt-6">
        <h2 id="details" className="text-lg text-navy-900">
          Details
        </h2>
        <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-4">
          <Fact
            label="Date of birth"
            value={
              pet.birthDate
                ? `${pet.birthDate}${pet.birthDateIsApprox ? " (estimate)" : ""}`
                : null
            }
          />
          <Fact
            label="Weight"
            value={pet.weight ? `${pet.weight.kg} kg (${pet.weight.measuredOn})` : null}
          />
          <Fact
            label="Sex"
            value={pet.sex === "UNKNOWN" ? null : pet.sex === "MALE" ? "Male" : "Female"}
          />
          <Fact
            label="Neutered"
            value={pet.neutered === true ? "Yes" : pet.neutered === false ? "No" : null}
          />
          <Fact label="Microchip number" value={pet.microchipNumber} className="col-span-2" />
        </dl>
      </section>

      <section aria-labelledby="vaccinations" className="mt-6">
        <h2 id="vaccinations" className="text-lg text-navy-900">
          Vaccinations
        </h2>
        <ul className="mt-2 divide-y divide-mist">
          {pet.vaccines.map((v, i) => {
            const style = VACCINE_PILL[v.status] ?? VACCINE_PILL.NEVER_GIVEN;
            return (
              <li key={i} className="flex items-center justify-between gap-3 py-2.5">
                <div>
                  <p className="text-sm font-medium">
                    {v.name}
                    {v.isCore && (
                      <span className="ml-2 text-xs font-normal text-ink-soft">core</span>
                    )}
                  </p>
                  <p className="text-xs text-ink-soft">
                    {v.lastGivenOn ? `Given ${v.lastGivenOn}` : "Never recorded"}
                    {v.nextDueOn && ` · due ${v.nextDueOn}`}
                  </p>
                </div>
                <StatusPill tone={style.tone} icon={style.icon}>{style.label}</StatusPill>
              </li>
            );
          })}
        </ul>
      </section>

      <p className="mt-8 border-t border-mist pt-4 text-xs leading-5 text-ink-soft">
        Shared by the owner from Max Petcare. Shown as recorded on {pet.updatedOn};
        the owner keeps this information and it may be incomplete. This is a
        summary, not a full medical record — in an emergency, contact a vet.
      </p>
    </main>
  );
}
