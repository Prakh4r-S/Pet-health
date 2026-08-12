import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/current-user";

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

  const pets = await prisma.pet.findMany({
    where: { ownerId: user.id, archivedAt: null },
    orderBy: { createdAt: "desc" },
    include: { species: true, breed: true },
  });

  return (
    <main className="mx-auto max-w-2xl px-6 py-10">
      <div className="mb-8 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Your pets</h1>
        <Link
          href="/pets/new"
          className="rounded-md bg-gray-900 px-4 py-2 text-sm text-white hover:bg-gray-700"
        >
          Add pet
        </Link>
      </div>

      {pets.length === 0 ? (
        <p className="rounded-md border border-dashed border-gray-300 p-8 text-center text-sm text-gray-500">
          No pets yet. Add one to start keeping records.
        </p>
      ) : (
        <ul className="grid gap-3">
          {pets.map((pet) => (
            <li key={pet.id} className="rounded-md border border-gray-200 p-4">
              <p className="font-medium">{pet.name}</p>
              <p className="text-sm text-gray-600">
                {pet.species.name}
                {" · "}
                {pet.breed?.name ?? pet.breedFreeText ?? "Unknown breed"}
                {" · "}
                {describeAge(pet.birthDate, pet.birthDateIsApprox)}
              </p>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
