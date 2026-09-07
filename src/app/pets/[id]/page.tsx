import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/current-user";
import { getPetAccess } from "@/lib/pet-access";
import { getVaccineStandings, type VaccineStatus } from "@/lib/vaccine-status";
import { logVaccination, logWeight } from "./actions";
import WeightChart from "@/components/weight-chart";
import DocumentsSection from "@/components/documents-section";

const field = "w-full rounded-md border border-gray-300 px-3 py-2 text-sm";
const button = "rounded-md bg-pine-900 px-4 py-2 text-sm text-white hover:bg-pine-700";
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
  const { id } = await params;
  const user = await getCurrentUser();

  const access = await getPetAccess(id, user.id);
  if (!access) notFound();

  const isVet = access.role === "TREATING_VET";

  const pet = await prisma.pet.findUniqueOrThrow({
    where: { id },
    include: {
      species: true,
      breed: true,
      owner: { select: { name: true } },
      weights: { orderBy: { measuredAt: "asc" } },
      allergies: { where: { active: true } },
      conditions: { orderBy: { diagnosedOn: "desc" } },
      documents: {
        orderBy: { createdAt: "desc" },
        include: { uploadedBy: { select: { name: true } } },
      },
    },
  });

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
      <Link
        href={isVet ? "/vet/appointments" : "/pets"}
        className="text-sm text-gray-500 hover:underline"
      >
        {isVet ? "Back to schedule" : "Back to pets"}
      </Link>

      <header className="mb-8 mt-3">
        <h1 className="text-2xl font-semibold">{pet.name}</h1>
        <p className="text-sm text-gray-600">
          {pet.species.name}
          {" · "}
          {pet.breed?.name ?? pet.breedFreeText ?? "Unknown breed"}
          {latestWeight && ` · ${Number(latestWeight.weightKg)} kg`}
          {isVet && ` · owner: ${pet.owner.name ?? "—"}`}
        </p>
      </header>

      {isVet && (
        <div className="mb-8 rounded-md border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
          You can see these records because you have an appointment with {pet.name}.
          They are read-only.
        </div>
      )}

      {needsAttention.length > 0 && (
        <div className="mb-8 rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-900">
          Core vaccinations needing attention:{" "}
          {needsAttention.map((s) => s.name).join(", ")}.
        </div>
      )}

      {(pet.allergies.length > 0 || pet.conditions.length > 0) && (
        <section className={`${card} mb-6`}>
          <h2 className="mb-3 font-medium">Medical history</h2>
          {pet.allergies.length > 0 && (
            <p className="mb-2 text-sm">
              <span className="text-gray-500">Allergies: </span>
              {pet.allergies.map((a) => a.allergen).join(", ")}
            </p>
          )}
          {pet.conditions.length > 0 && (
            <ul className="text-sm">
              {pet.conditions.map((c) => (
                <li key={c.id} className="text-gray-700">
                  {c.name}
                  <span className="text-gray-500">
                    {c.resolvedOn ? " · resolved" : " · ongoing"}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
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
          </p>
        )}

        {access.canEdit && (
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
            <button type="submit" className={button}>Log weight</button>
          </form>
        )}
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

        {access.canEdit && (
          <form action={logVaccination} className="mt-5 flex flex-wrap items-end gap-3">
            <input type="hidden" name="petId" value={pet.id} />
            <div className="w-48">
              <label className="mb-1 block text-xs text-gray-600" htmlFor="vaccineTypeId">
                Vaccine
              </label>
              <select id="vaccineTypeId" name="vaccineTypeId" className={field} required>
                {vaccineTypes.map((v) => (
                  <option key={v.id} value={v.id}>{v.name}</option>
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
            <button type="submit" className={button}>Add record</button>
          </form>
        )}
      </section>
      <div className="mt-6">
        <DocumentsSection
          petId={pet.id}
          canUpload
          documents={pet.documents.map((d) => ({
            id: d.id,
            kind: d.kind,
            title: d.title,
            note: d.note,
            contentType: d.contentType,
            sizeBytes: d.sizeBytes,
            createdAt: d.createdAt.toISOString().slice(0, 10),
            uploadedByName: d.uploadedBy.name,
            canDelete: access.role === "OWNER" || d.uploadedById === user.id,
          }))}
        />
      </div>
    </main>
  );
}
