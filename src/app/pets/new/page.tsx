import Link from "next/link";
import PetForm from "@/components/pet-form";
import { prisma } from "@/lib/prisma";

export default async function NewPetPage() {
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
      <Link href="/pets" className="text-sm text-gray-500 hover:underline">
        Back to pets
      </Link>
      <h1 className="mb-8 mt-3 text-2xl font-semibold">Add a pet</h1>
      <PetForm species={species} />
    </main>
  );
}

