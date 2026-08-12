import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/current-user";
import { getVaccineStandings, type VaccineStatus } from "@/lib/vaccine-status";
import { logVaccination, logWeight } from "./actions";
import WeightChart from "@/components/weight-chart";

const field = "w-full rounded-md border border-gray-300 px-3 py-2 text-sm";
const button = "rounded-md bg-gray-900 px-4 py-2 text-sm text-white hover:bg-gray-700";
const card = "rounded-lg border border-gray-200 p-5";

const statusStyles: Record<VaccineStatus, { label: string; className: string }> = {
  NEVER_GIVEN: { label: "No record", className: "bg-gray-100 text-gray-700" },
  OVERDUE: { label: "Overdue", className: "bg-red-100 text-red-800" },
  DUE_SOON: { label: "Due soon", className: "bg-amber-100 text-amber-800" },
  UP_TO_DATE: { label: "Up to date", className: "bg-green-100 text-green-800" },
};

function fmt(d: Date | null) {
  return d ? d.toISOString().slice(0, 10) : "—";
}

export default async function PetDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  // Next.js 15+ passes params as a Promise.
  const { id } = await params;
  const user = await getCurrentUser();

  const pet = await prisma.pet.findFirst({
    where: { id, ownerId: user.id, archivedAt: null },
    include: {
      species: true,
      breed: true,
      weights: { orderBy: { measuredAt: "asc" } },
    },
  });

  if (!pet) notFound();

  const [standings, vaccineTypes] = await Promise.all([
    getVaccineStandings(pet.id),
    prisma.vaccineType.findMany({
      where: { speciesId: pet.speciesId },
      orderBy: [{ isCore: "desc" }, { name: "asc" }],
    }),
  ]);

  const chartData = pet.weights.map((w) => ({
    date: w.measuredAt.toISOString().slice(5, 10),
    weightKg: Number(w.weightKg),
  }));

  const latestWeight = pet.weights.at(-1);
  const today = new Date().toISOString().slice(0, 10);

  const needsAttention = standings.filter(
    (s) => s.isCore && (s.status === "OVERDUE" || s.status === "NEVER_GIVEN"),
  );

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <Link href="/pets" className="text-sm text-gray-500 hover:underline">
        Back to pets
      </Link>

      <header className="mb-8 mt-3">
        <h1 className="text-2xl font-semibold">{pet.name}</h1>
        <p className="text-sm text-gray-600">
          {pet.species.name}
          {" · "}
          {pet.breed?.name ?? pet.breedFreeText ?? "Unknown breed"}
          {latestWeight && ` · ${Number(latestWeight.weightKg)} kg`}
        </p>
      </header>

      {needsAttention.length > 0 && (
        <div className="mb-8 rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-900">
          Core vaccinations needing attention:{" "}
          {needsAttention.map((s) => s.name).join(", ")}.
        </div>
      )}

      <section className={`${card} mb-6`}>
        <h2 className="mb-4 font-medium">Weight</h2>
        <WeightChart
          data={chartData}
          healthyMin={pet.breed?.adultWeightMinKg ? Number(pet.breed.adultWeightMinKg) : null}
          healthyMax={pet.breed?.adultWeightMaxKg ? Number(pet.breed.adultWeightMaxKg) : null}
        />
        {pet.breed?.adultWeightMinKg && (
          <p className="mt-2 text-xs text-gray-500">
            Shaded band shows the typical adult range for {pet.breed.name} (
            {Number(pet.breed.adultWeightMinKg)}–{Number(pet.breed.adultWeightMaxKg)} kg).
            Puppies and kittens are expected to sit below it.
          </p>
        )}

        <form action={logWeight} className="mt-5 flex flex-wrap items-end gap-3">
          <input type="hidden" name="petId" value={pet.id} />
          <div className="w-32">
            <label className="mb-1 block text-xs text-gray-600" htmlFor="weightKg">
              Weight (kg)
            </label>
            <input
              id="weightKg"
              name="weightKg"
              type="number"
              step="0.01"
              min="0.1"
              className={field}
              required
            />
          </div>
          <div className="w-44">
            <label className="mb-1 block text-xs text-gray-600" htmlFor="measuredAt">
              Date
            </label>
            <input
              id="measuredAt"
              name="measuredAt"
              type="date"
              max={today}
              defaultValue={today}
              className={field}
            />
          </div>
          <button type="submit" className={button}>
            Log weight
          </button>
        </form>
      </section>

      <section className={card}>
        <h2 className="mb-4 font-medium">Vaccinations</h2>

        <ul className="divide-y divide-gray-100">
          {standings.map((s) => {
            const style = statusStyles[s.status];
            return (
              <li key={s.vaccineTypeId} className="flex items-center justify-between py-3">
                <div>
                  <p className="text-sm font-medium">
                    {s.name}
                    {s.isCore && (
                      <span className="ml-2 text-xs font-normal text-gray-500">core</span>
                    )}
                  </p>
                  <p className="text-xs text-gray-500">
                    Last given {fmt(s.lastGivenOn)} · Next due {fmt(s.nextDueOn)}
                  </p>
                </div>
                <span className={`rounded-full px-2.5 py-1 text-xs ${style.className}`}>
                  {style.label}
                </span>
              </li>
            );
          })}
        </ul>

        <form action={logVaccination} className="mt-5 flex flex-wrap items-end gap-3">
          <input type="hidden" name="petId" value={pet.id} />
          <div className="w-48">
            <label className="mb-1 block text-xs text-gray-600" htmlFor="vaccineTypeId">
              Vaccine
            </label>
            <select id="vaccineTypeId" name="vaccineTypeId" className={field} required>
              {vaccineTypes.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                </option>
              ))}
            </select>
          </div>
          <div className="w-44">
            <label className="mb-1 block text-xs text-gray-600" htmlFor="administeredOn">
              Date given
            </label>
            <input
              id="administeredOn"
              name="administeredOn"
              type="date"
              max={today}
              defaultValue={today}
              className={field}
              required
            />
          </div>
          <div className="w-48">
            <label className="mb-1 block text-xs text-gray-600" htmlFor="administeredBy">
              Clinic (optional)
            </label>
            <input id="administeredBy" name="administeredBy" className={field} />
          </div>
          <button type="submit" className={button}>
            Add record
          </button>
        </form>
      </section>
    </main>
  );
}
