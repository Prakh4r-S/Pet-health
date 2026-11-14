import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/current-user";
import { getPetAccess } from "@/lib/pet-access";
import { getVaccineStandings, type VaccineStatus } from "@/lib/vaccine-status";
import { logVaccination, logWeight } from "./actions";
import WeightChart from "@/components/weight-chart";
import DocumentsSection from "@/components/documents-section";
import PetEditForm from "@/components/pet-edit-form";
import PetMedicalHistory from "@/components/pet-medical-history";
import ConsultationRecordView from "@/components/consultation-record";
import LocalTime from "@/components/local-time";
import { consultationRecordSelect, toOwnerRecord } from "@/lib/consultation-records";
import ActionForm from "@/components/action-form";
import SubmitButton from "@/components/submit-button";


const field = "w-full rounded-md border border-mist-deep px-3 py-2 text-sm";
const card = "rounded-lg border border-mist p-5";

const statusStyles: Record<VaccineStatus, { label: string; className: string }> = {
  NEVER_GIVEN: { label: "No record", className: "bg-mist text-ink" },
  OVERDUE: { label: "Overdue", className: "bg-red-100 text-red-800" },
  DUE_SOON: { label: "Due soon", className: "bg-amber-100 text-amber-800" },
  UP_TO_DATE: { label: "Up to date", className: "bg-aqua-100 text-navy-900" },
};

function fmt(d: Date | null) {
  return d ? d.toISOString().slice(0, 10) : "—";
}

function fmtOrNull(d: Date | null) {
  return d ? d.toISOString().slice(0, 10) : null;
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

  const [standings, vaccineTypes, breeds, pastAppointments] = await Promise.all([
    getVaccineStandings(pet.id),
    prisma.vaccineType.findMany({
      where: { speciesId: pet.speciesId },
      orderBy: [{ isCore: "desc" }, { name: "asc" }],
    }),
    access.canEdit
      ? prisma.breed.findMany({
          where: { speciesId: pet.speciesId },
          orderBy: { name: "asc" },
          select: { id: true, name: true },
        })
      : [],
    // Fetched for the owner only; see the section below for why.
    access.role === "OWNER"
      ? prisma.appointment.findMany({
          where: { petId: pet.id, note: { status: "FINALISED" } },
          orderBy: { startsAt: "desc" },
          take: 20,
          select: {
            id: true,
            startsAt: true,
            reason: true,
            vetProfile: { select: { user: { select: { name: true } } } },
            note: { select: consultationRecordSelect },
          },
        })
      : [],
  ]);

  const consultations = pastAppointments.flatMap((a) => {
    const record = toOwnerRecord(a.note);
    return record
      ? [
          {
            id: a.id,
            startsAt: a.startsAt.toISOString(),
            reason: a.reason,
            vetName: a.vetProfile.user.name,
            record,
          },
        ]
      : [];
  });

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
        className="text-sm text-ink-soft hover:underline"
      >
        {isVet ? "Back to schedule" : "Back to pets"}
      </Link>

      <header className="mb-8 mt-3">
        <h1 className="text-2xl text-navy-900">{pet.name}</h1>
        <p className="text-sm text-ink-soft">
          {pet.species.name}
          {" · "}
          {pet.breed?.name ?? pet.breedFreeText ?? "Unknown breed"}
          {pet.sex !== "UNKNOWN" && ` · ${pet.sex.toLowerCase()}`}
          {pet.neutered === true && " · neutered"}
          {latestWeight && ` · ${Number(latestWeight.weightKg)} kg`}
          {pet.microchipNumber && ` · chip ${pet.microchipNumber}`}
          {isVet && ` · owner: ${pet.owner.name ?? "—"}`}
        </p>
      </header>

      {isVet && (
        <div className="mb-8 rounded-md border border-aqua-100 bg-aqua-50 p-4 text-sm text-navy-900">
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

      {access.canEdit && (
        <PetEditForm
          breeds={breeds}
          pet={{
            id: pet.id,
            name: pet.name,
            speciesName: pet.species.name,
            breedId: pet.breedId,
            breedFreeText: pet.breedFreeText,
            sex: pet.sex,
            neutered: pet.neutered,
            microchipNumber: pet.microchipNumber,
            birthDate: fmtOrNull(pet.birthDate),
            birthDateIsApprox: pet.birthDateIsApprox,
          }}
        />
      )}

      <PetMedicalHistory
        petId={pet.id}
        canEdit={access.canEdit}
        allergies={pet.allergies.map((a) => ({
          id: a.id,
          allergen: a.allergen,
          reaction: a.reaction,
          severity: a.severity,
        }))}
        conditions={pet.conditions.map((c) => ({
          id: c.id,
          name: c.name,
          notes: c.notes,
          diagnosedOn: fmtOrNull(c.diagnosedOn),
          resolvedOn: fmtOrNull(c.resolvedOn),
        }))}
      />

      {/* The owner's own copy of what each vet concluded and prescribed.
          Owner only: a treating vet's access here is to the pet's
          records as the owner keeps them, and whether one vet should
          read another's notes is a decision this page does not make. */}
      {access.role === "OWNER" && (
        <section className={`${card} mb-6`}>
          <h2 className="mb-1 font-medium">Consultation records</h2>
          {consultations.length === 0 ? (
            <p className="mt-2 text-sm text-ink-faint">
              Nothing yet. A record appears here once a vet has finalised their
              notes after a consultation.
            </p>
          ) : (
            <ul className="divide-y divide-mist">
              {consultations.map((c) => (
                <li key={c.id} className="py-4">
                  <p className="mb-3 text-sm">
                    <span className="font-medium">
                      <LocalTime date={c.startsAt} format="dayTime" />
                    </span>
                    <span className="text-ink-soft"> · {c.vetName ?? "Vet"}</span>
                    {c.reason && <span className="text-ink-soft"> · {c.reason}</span>}
                  </p>
                  <ConsultationRecordView record={c.record} />
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
          <p className="mt-2 text-xs text-ink-soft">
            Shaded band shows the typical adult range for {pet.breed.name} (
            {Number(pet.breed.adultWeightMinKg)}–{Number(pet.breed.adultWeightMaxKg)} kg).
          </p>
        )}

        {access.canEdit && (
          <ActionForm action={logWeight} className="mt-5 flex flex-wrap items-end gap-3">
            <input type="hidden" name="petId" value={pet.id} />
            <div className="w-32">
              <label className="mb-1 block text-xs text-ink-soft" htmlFor="weightKg">
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
              <label className="mb-1 block text-xs text-ink-soft" htmlFor="measuredAt">
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
            <SubmitButton pendingLabel="Saving...">Log weight</SubmitButton>
          </ActionForm>
        )}
      </section>

      <section className={card}>
        <h2 className="mb-4 font-medium">Vaccinations</h2>

        <ul className="divide-y divide-mist">
          {standings.map((s) => {
            const style = statusStyles[s.status];
            return (
              <li key={s.vaccineTypeId} className="flex items-center justify-between py-3">
                <div>
                  <p className="text-sm font-medium">
                    {s.name}
                    {s.isCore && (
                      <span className="ml-2 text-xs font-normal text-ink-soft">core</span>
                    )}
                  </p>
                  <p className="text-xs text-ink-soft">
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
          <ActionForm action={logVaccination} className="mt-5 flex flex-wrap items-end gap-3">
            <input type="hidden" name="petId" value={pet.id} />
            <div className="w-48">
              <label className="mb-1 block text-xs text-ink-soft" htmlFor="vaccineTypeId">
                Vaccine
              </label>
              <select id="vaccineTypeId" name="vaccineTypeId" className={field} required>
                {vaccineTypes.map((v) => (
                  <option key={v.id} value={v.id}>{v.name}</option>
                ))}
              </select>
            </div>
            <div className="w-44">
              <label className="mb-1 block text-xs text-ink-soft" htmlFor="administeredOn">
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
              <label className="mb-1 block text-xs text-ink-soft" htmlFor="administeredBy">
                Clinic (optional)
              </label>
              <input id="administeredBy" name="administeredBy" className={field} />
            </div>
            <SubmitButton pendingLabel="Saving...">Add record</SubmitButton>
          </ActionForm>
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
