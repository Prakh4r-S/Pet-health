import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireVetProfile } from "@/lib/current-user";
import VetProfileForm from "@/components/vet-profile-form";

export const metadata: Metadata = { title: "Clinic profile · Max Petcare" };

export default async function VetProfilePage() {
  const { user, profile } = await requireVetProfile();

  const [account, specialisations] = await Promise.all([
    // The session has a name and the provider's picture, but not the
    // photo uploaded on the owner profile.
    prisma.user.findUniqueOrThrow({
      where: { id: user.id },
      select: { name: true, image: true, avatarUrl: true },
    }),
    prisma.specialisation.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  return (
    <main className="mx-auto max-w-2xl px-6 py-10">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h1 className="text-2xl text-navy-900">Clinic profile</h1>
        <Link href={`/vets/${profile.id}`} className="text-sm text-navy-700 hover:underline">
          View as an owner sees it
        </Link>
      </div>
      <p className="mb-8 mt-1 text-sm text-ink-soft">
        What owners read before they book you. Consulting hours and days off are
        under{" "}
        <Link href="/vet/availability" className="text-navy-700 underline">
          Availability
        </Link>
        .
      </p>

      <VetProfileForm
        specialisations={specialisations}
        profile={{
          name: account.name,
          accountPhotoUrl: account.avatarUrl ?? account.image,
          avatarUrl: profile.avatarUrl,
          clinicImageUrl: profile.clinicImageUrl,
          licenceNumber: profile.licenceNumber,
          qualifications: profile.qualifications,
          yearsExperience: profile.yearsExperience,
          consultationFee: profile.consultationFee,
          bio: profile.bio,
          specialties: profile.specialties,
          specialisationIds: profile.specialisations.map((s) => s.id),
          clinicName: profile.clinicName,
          clinicAddress: profile.clinicAddress,
          city: profile.city,
          state: profile.state,
          postalCode: profile.postalCode,
          latitude: profile.latitude,
          longitude: profile.longitude,
          acceptingNewPatients: profile.acceptingNewPatients,
        }}
      />
    </main>
  );
}
