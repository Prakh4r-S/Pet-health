import Link from "next/link";
import PetForm from "@/components/pet-form";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/current-user";

export const dynamic = "force-dynamic";

export default async function NewPetPage() {
  // The form's action checks this too. Guarding the page as well means a
  // signed-out visitor is asked to sign in before filling the form in,
  // not after.
  await getCurrentUser();

  const species = await prisma.species.findMany({
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      breeds: { orderBy: { name: "asc" }, select: { id: true, name: true } },
    },
  });

  return (
    <main className="mx-auto max-w-xl px-6 py-10">
      <Link href="/pets" className="text-sm text-ink-soft hover:underline">
        Back to pets
      </Link>
      <h1 className="mb-8 mt-3 text-2xl text-navy-900">Add a pet</h1>
      <PetForm species={species} />
    </main>
  );
}

