import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/current-user";
import PetAvatar from "@/components/pet-avatar";
import VetCard from "@/components/vet-card";
import { getVetRecommendations } from "@/lib/vet-matching";


function describeAge(birthDate: Date | null, approx: boolean) {
  if (!birthDate) return "Age unknown";

  const now = new Date();
  let months =
    (now.getFullYear() - birthDate.getFullYear()) * 12 +
    (now.getMonth() - birthDate.getMonth());
  if (now.getDate() < birthDate.getDate()) months -= 1;
  if (months < 0) return "Age unknown";

  const years = Math.floor(months / 12);
  const rest = months % 12;
  const text =
    years === 0
      ? `${rest} mo`
      : rest === 0
        ? `${years} yr`
        : `${years} yr ${rest} mo`;

  return approx ? `about ${text}` : text;
}

export default async function PetsPage() {
  const user = await getCurrentUser();

  const [pets, recommended] = await Promise.all([
    prisma.pet.findMany({
      where: { ownerId: user.id, archivedAt: null },
      orderBy: { createdAt: "desc" },
      include: { species: true, breed: true },
    }),
    getVetRecommendations(user.id, { limit: 3 }),
  ]);

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
     <div className="mb-8 flex items-center justify-between">
        <h1 className="text-2xl text-navy-900">Your pets</h1>
          <Link
            href="/pets/new"
            className="rounded-md bg-navy-900 px-4 py-2 text-sm text-white hover:bg-navy-700"
          >
            Add pet
          </Link>
        </div>

      {pets.length === 0 ? (
        <p className="rounded-md border border-dashed border-mist-deep p-8 text-center text-sm text-ink-soft">
          No pets yet. Add one to start keeping records.
        </p>
      ) : (
        <ul className="grid gap-3">
          {pets.map((pet) => (
            <li key={pet.id} className="flex items-center gap-4 rounded-md border border-mist p-4">
              <PetAvatar
                name={pet.name}
                speciesSlug={pet.species.slug}
                photoUrl={pet.photoUrl}
              />
              <div className="min-w-0">
                <Link href={`/pets/${pet.id}`} className="font-medium hover:underline">
                  {pet.name}
                </Link>
                <p className="text-sm text-ink-soft">
                  {pet.species.name}
                  {" · "}
                  {pet.breed?.name ?? pet.breedFreeText ?? "Unknown breed"}
                  {" · "}
                  {describeAge(pet.birthDate, pet.birthDateIsApprox)}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}

      {recommended.vets.length > 0 && (
        <section aria-labelledby="recommended-vets" className="mt-12">
          <div className="mb-4 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <h2 id="recommended-vets" className="text-lg text-navy-900">
              {recommended.ownerHasLocation
                ? "Recommended Vets Near You"
                : "Recommended Vets"}
            </h2>
            <Link href="/vets" className="text-sm text-navy-700 hover:underline">
              See all vets
            </Link>
          </div>

          {!recommended.ownerHasLocation && (
            <p className="mb-4 text-sm text-ink-soft">
              <Link href="/profile" className="text-navy-700 underline">
                Set your location
              </Link>{" "}
              to see the ones nearest you.
            </p>
          )}

          <ul className="grid gap-3 sm:grid-cols-3">
            {recommended.vets.map((vet) => (
              <li key={vet.id}>
                <VetCard vet={vet} variant="compact" />
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
