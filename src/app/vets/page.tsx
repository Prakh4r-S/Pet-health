import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/current-user";
import { findVetsAvailableNow } from "@/lib/slots";
import InstantMatch from "@/components/instant-match";

const card = "rounded-lg border border-gray-200 p-5 hover:border-gray-400";

export default async function VetsPage({
  searchParams,
}: {
  searchParams: Promise<{ specialisation?: string }>;
}) {
  const user = await getCurrentUser();
  const { specialisation } = await searchParams;

  const [vets, specialisations, pets, availableNow] = await Promise.all([
    prisma.vetProfile.findMany({
      where: {
        verifiedAt: { not: null },
        acceptingNewPatients: true,
        ...(specialisation ? { specialisations: { some: { slug: specialisation } } } : {}),
      },
      include: {
        user: { select: { name: true, image: true } },
        specialisations: true,
      },
      orderBy: { yearsExperience: "desc" },
    }),
    prisma.specialisation.findMany({ orderBy: { name: "asc" } }),
    prisma.pet.findMany({
      where: { ownerId: user.id, archivedAt: null },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    findVetsAvailableNow(specialisation),
  ]);

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Find a vet</h1>
        <Link href="/appointments" className="text-sm text-gray-500 hover:underline">
          Your appointments
        </Link>
      </div>

      <InstantMatch
        pets={pets}
        specialisationSlug={specialisation}
        availableCount={availableNow.length}
      />

      <div className="mb-8 flex flex-wrap gap-2">
        <Link
          href="/vets"
          className={`rounded-full px-3 py-1 text-sm ${
            !specialisation ? "bg-pine-900 text-white" : "bg-gray-100 hover:bg-gray-200"
          }`}
        >
          All
        </Link>
        {specialisations.map((s) => (
          <Link
            key={s.id}
            href={`/vets?specialisation=${s.slug}`}
            className={`rounded-full px-3 py-1 text-sm ${
              specialisation === s.slug
                ? "bg-pine-900 text-white"
                : "bg-gray-100 hover:bg-gray-200"
            }`}
          >
            {s.name}
          </Link>
        ))}
      </div>

      {vets.length === 0 ? (
        <p className="rounded-md border border-dashed border-gray-300 p-8 text-center text-sm text-gray-500">
          No vets available{specialisation && " in this specialisation"}.
        </p>
      ) : (
        <ul className="grid gap-3">
          {vets.map((vet) => (
            <li key={vet.id}>
              <Link href={`/vets/${vet.id}`} className={`block ${card}`}>
                <p className="font-medium">{vet.user.name ?? "Vet"}</p>
                <p className="mt-0.5 text-sm text-gray-600">
                  {vet.clinicName ?? "Independent"}
                  {vet.city && ` · ${vet.city}`}
                  {vet.yearsExperience != null && ` · ${vet.yearsExperience} yrs`}
                </p>
                {vet.specialisations.length > 0 && (
                  <p className="mt-2 text-xs text-gray-500">
                    {vet.specialisations.map((s) => s.name).join(" · ")}
                  </p>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
