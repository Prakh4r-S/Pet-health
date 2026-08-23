import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/current-user";
import { getAvailableSlots } from "@/lib/slots";
import SlotPicker from "@/components/slot-picker";

export default async function VetDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await getCurrentUser();

  const vet = await prisma.vetProfile.findFirst({
    where: { id, verifiedAt: { not: null } },
    include: {
      user: { select: { name: true } },
      specialisations: true,
    },
  });
  if (!vet) notFound();

  const [pets, slots] = await Promise.all([
    prisma.pet.findMany({
      where: { ownerId: user.id, archivedAt: null },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    getAvailableSlots(vet.id),
  ]);

  return (
    <main className="mx-auto max-w-2xl px-6 py-10">
      <Link href="/vets" className="text-sm text-gray-500 hover:underline">
        Back to vets
      </Link>

      <header className="mb-8 mt-3">
        <h1 className="text-2xl font-semibold">{vet.user.name ?? "Vet"}</h1>
        <p className="text-sm text-gray-600">
          {vet.clinicName ?? "Independent"}
          {vet.city && ` · ${vet.city}`}
          {vet.yearsExperience != null && ` · ${vet.yearsExperience} years`}
          {` · ${vet.slotMinutes}-minute appointments`}
        </p>
        {vet.specialisations.length > 0 && (
          <p className="mt-2 text-xs text-gray-500">
            {vet.specialisations.map((s) => s.name).join(" · ")}
          </p>
        )}
        {vet.bio && <p className="mt-4 text-sm leading-6 text-gray-700">{vet.bio}</p>}
      </header>

      <section className="rounded-lg border border-gray-200 p-5">
        <h2 className="mb-4 font-medium">Book an appointment</h2>
        <SlotPicker
          vetProfileId={vet.id}
          pets={pets}
          slots={slots.map((s) => s.startsAt.toISOString())}
        />
      </section>
    </main>
  );
}
