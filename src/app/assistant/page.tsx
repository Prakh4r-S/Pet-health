import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/current-user";
import AssistantChat from "@/components/assistant-chat";

export const dynamic = "force-dynamic";

export default async function AssistantPage() {
  const user = await getCurrentUser();

  const petCount = await prisma.pet.count({
    where: { ownerId: user.id, archivedAt: null },
  });

  return (
    <main className="mx-auto max-w-2xl px-6 py-10">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl text-pine-900">Ask about your pets</h1>
        <Link href="/pets" className="text-sm text-bark-soft hover:underline">
          Your pets
        </Link>
      </div>

      <AssistantChat hasPets={petCount > 0} />
    </main>
  );
}
