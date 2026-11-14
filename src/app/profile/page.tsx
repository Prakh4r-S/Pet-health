import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/current-user";
import ProfileForm from "@/components/profile-form";
import PetAvatar from "@/components/pet-avatar";

export const metadata: Metadata = { title: "Your profile · Max Petcare" };

export default async function ProfilePage() {
  const user = await getCurrentUser();

  // Read from the database rather than the session: the session carries
  // a name and picture, but none of the profile fields.
  const profile = await prisma.user.findUniqueOrThrow({
    where: { id: user.id },
    select: {
      name: true,
      email: true,
      image: true,
      avatarUrl: true,
      age: true,
      phone: true,
      bio: true,
      city: true,
      state: true,
      postalCode: true,
      latitude: true,
      longitude: true,
      vetProfile: { select: { id: true } },
      pets: {
        where: { archivedAt: null },
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          name: true,
          photoUrl: true,
          species: { select: { slug: true } },
        },
      },
    },
  });

  const { pets, vetProfile, email, image, ...fields } = profile;

  return (
    <main className="mx-auto max-w-2xl px-6 py-10">
      <h1 className="text-2xl text-navy-900">Your profile</h1>
      {email && <p className="mt-1 text-sm text-ink-soft">Signed in as {email}</p>}

      <section
        aria-labelledby="profile-pets"
        className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-3 rounded-lg border border-mist bg-aqua-50 p-4"
      >
        <h2 id="profile-pets" className="text-sm font-medium text-navy-900">
          <span className="mr-2 rounded-full bg-navy-900 px-2.5 py-0.5 text-xs text-white">
            {pets.length}
          </span>
          {pets.length === 1 ? "Registered pet" : "Registered pets"}
        </h2>

        {pets.length > 0 && (
          <ul className="flex flex-wrap gap-2">
            {pets.map((pet) => (
              <li key={pet.id}>
                <Link
                  href={`/pets/${pet.id}`}
                  className="flex items-center gap-2 rounded-full border border-mist bg-white py-1 pl-1 pr-3 text-sm hover:border-mist-deep"
                >
                  <PetAvatar
                    name={pet.name}
                    speciesSlug={pet.species.slug}
                    photoUrl={pet.photoUrl}
                    size="sm"
                  />
                  {pet.name}
                </Link>
              </li>
            ))}
          </ul>
        )}

        <Link
          href={pets.length > 0 ? "/pets" : "/pets/new"}
          className="ml-auto whitespace-nowrap text-sm text-navy-700 hover:underline"
        >
          {pets.length > 0 ? "Manage pets" : "Add a pet"}
        </Link>
      </section>

      <div className="mt-8">
        <ProfileForm profile={{ ...fields, providerImage: image }} />
      </div>

      {!vetProfile && (
        <aside className="mt-10 rounded-lg border border-mist p-5">
          <h2 className="text-base text-navy-900">Are you a veterinarian?</h2>
          <p className="mt-1 text-sm text-ink-soft">
            Set up a practitioner profile to take appointments on Max Petcare.
            You keep this account and your own pets.
          </p>
          <Link
            href="/vet/onboarding"
            className="mt-3 inline-block text-sm font-medium text-navy-700 hover:underline"
          >
            Set up a vet profile
          </Link>
        </aside>
      )}
    </main>
  );
}
