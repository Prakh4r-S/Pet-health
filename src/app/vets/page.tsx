import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/current-user";
import { findVetsAvailableNow } from "@/lib/slots";
import { getVetRecommendations, RADIUS_OPTIONS, type Radius } from "@/lib/vet-matching";
import InstantMatch from "@/components/instant-match";
import VetCard from "@/components/vet-card";

type Filters = { specialisation?: string; pet?: string; radius?: string };

const RADIUS_LABEL: Record<Radius, string> = {
  near: "Near me",
  "10": "Within 10 km",
  "50": "Within 50 km",
  all: "All locations",
};

const pill = "rounded-full px-3 py-1 text-sm";
const pillOn = `${pill} bg-navy-900 text-white`;
const pillOff = `${pill} bg-mist hover:bg-aqua-100`;

/** The directory's address with one filter changed and the others kept. */
function hrefWith(current: Filters, change: Filters) {
  const next = { ...current, ...change };
  const params = new URLSearchParams();
  if (next.pet) params.set("pet", next.pet);
  if (next.radius && next.radius !== "all") params.set("radius", next.radius);
  if (next.specialisation) params.set("specialisation", next.specialisation);
  const query = params.toString();
  return query ? `/vets?${query}` : "/vets";
}

function FilterRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="mr-1 w-full text-xs font-medium text-ink-soft sm:w-28">{label}</span>
      {children}
    </div>
  );
}

export default async function VetsPage({
  searchParams,
}: {
  searchParams: Promise<Filters>;
}) {
  const user = await getCurrentUser();
  const query = await searchParams;

  const specialisation = query.specialisation || undefined;
  const requestedRadius: Radius = (RADIUS_OPTIONS as readonly string[]).includes(
    query.radius ?? "",
  )
    ? (query.radius as Radius)
    : "all";

  const [recommendations, specialisations, availableNow] = await Promise.all([
    getVetRecommendations(user.id, {
      petId: query.pet,
      radius: requestedRadius,
      specialisationSlug: specialisation,
    }),
    prisma.specialisation.findMany({ orderBy: { name: "asc" } }),
    findVetsAvailableNow(specialisation),
  ]);

  const { vets, pets, selectedPetId, radius, ownerHasLocation, ownerHasCoordinates } =
    recommendations;

  // What the links below are built from: only filters that took effect,
  // so a pet id that is not the owner's does not ride along in the URL.
  const current: Filters = {
    specialisation,
    pet: selectedPetId ?? undefined,
    radius,
  };
  const selectedPet = pets.find((p) => p.id === selectedPetId);

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl text-navy-900">Find a vet</h1>
        <Link href="/appointments" className="text-sm text-ink-soft hover:underline">
          Your appointments
        </Link>
      </div>

      {!ownerHasCoordinates && (
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-aqua-100 bg-aqua-50 p-4 text-sm text-navy-900">
          <p>
            {ownerHasLocation
              ? "Add your exact location to see how far each clinic is, not just which are in your city."
              : "Set your location to see the vets nearest you first."}
          </p>
          <Link
            href="/profile"
            className="whitespace-nowrap rounded-md bg-navy-900 px-3 py-1.5 text-white hover:bg-navy-700"
          >
            Set your location
          </Link>
        </div>
      )}

      <InstantMatch
        pets={pets}
        specialisationSlug={specialisation}
        availableCount={availableNow.length}
      />

      <div className="mb-8 grid gap-3">
        {pets.length > 0 && (
          <FilterRow label="Recommend for">
            <Link
              href={hrefWith(current, { pet: undefined })}
              aria-current={!selectedPetId ? "true" : undefined}
              className={!selectedPetId ? pillOn : pillOff}
            >
              All pets
            </Link>
            {pets.map((pet) => (
              <Link
                key={pet.id}
                href={hrefWith(current, { pet: pet.id })}
                aria-current={selectedPetId === pet.id ? "true" : undefined}
                className={selectedPetId === pet.id ? pillOn : pillOff}
              >
                {pet.name}
              </Link>
            ))}
          </FilterRow>
        )}

        <FilterRow label="Location">
          {RADIUS_OPTIONS.map((option) =>
            // Without anything to measure from, only "all" means anything.
            ownerHasLocation || option === "all" ? (
              <Link
                key={option}
                href={hrefWith(current, { radius: option })}
                aria-current={radius === option ? "true" : undefined}
                className={radius === option ? pillOn : pillOff}
              >
                {RADIUS_LABEL[option]}
              </Link>
            ) : (
              <span
                key={option}
                aria-disabled="true"
                title="Set your location to use this"
                className={`${pill} cursor-not-allowed bg-mist text-ink-faint`}
              >
                {RADIUS_LABEL[option]}
              </span>
            ),
          )}
        </FilterRow>

        <FilterRow label="Specialisation">
          <Link
            href={hrefWith(current, { specialisation: undefined })}
            aria-current={!specialisation ? "true" : undefined}
            className={!specialisation ? pillOn : pillOff}
          >
            All
          </Link>
          {specialisations.map((s) => (
            <Link
              key={s.id}
              href={hrefWith(current, { specialisation: s.slug })}
              aria-current={specialisation === s.slug ? "true" : undefined}
              className={specialisation === s.slug ? pillOn : pillOff}
            >
              {s.name}
            </Link>
          ))}
        </FilterRow>
      </div>

      <p className="mb-3 text-sm text-ink-soft" role="status">
        {vets.length === 1 ? "1 vet" : `${vets.length} vets`}, best match
        {selectedPet ? ` for ${selectedPet.name}` : pets.length > 0 ? " for your pets" : ""} first.
      </p>

      {vets.length === 0 ? (
        <div className="rounded-md border border-dashed border-mist-deep p-8 text-center text-sm text-ink-soft">
          <p>
            No vets available
            {specialisation && " in this specialisation"}
            {radius !== "all" && ` ${RADIUS_LABEL[radius].toLowerCase()}`}.
          </p>
          {(radius !== "all" || specialisation) && (
            <Link
              href={hrefWith(current, { radius: "all", specialisation: undefined })}
              className="mt-2 inline-block text-navy-700 underline"
            >
              Show all vets
            </Link>
          )}
        </div>
      ) : (
        <ul className="grid gap-3">
          {vets.map((vet) => (
            <li key={vet.id}>
              <VetCard vet={vet} />
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
