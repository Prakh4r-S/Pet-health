import { prisma } from "@/lib/prisma";
import { followUpClosesAt, type FollowUpThread } from "@/lib/follow-up-rules";

export * from "@/lib/follow-up-rules";

/**
 * The short message thread that stays open after a consultation.
 *
 * Plain data out — ISO strings, no Dates — so one loader serves the
 * owner's server-rendered list and the client component that posts.
 */

function isMissingTable(error: unknown) {
  return (
    typeof error === "object" && error !== null && "code" in error && error.code === "P2021"
  );
}

/**
 * Threads for a set of appointments the caller has already established
 * the viewer may see.
 *
 * `available: false` means the table is not there yet — the code is
 * running ahead of its migration, as a preview build always is. The
 * pages then leave the thread out rather than failing.
 */
export async function getFollowUpThreads(
  appointments: {
    id: string;
    status: string;
    endsAt: Date;
    note?: { finalisedAt: Date | null } | null;
    vetProfile: { userId: string };
  }[],
  viewerId: string,
): Promise<{ available: boolean; threads: Map<string, FollowUpThread> }> {
  const threads = new Map<string, FollowUpThread>();
  const now = Date.now();

  const relevant = appointments.filter((a) => a.status === "COMPLETED");
  if (relevant.length === 0) return { available: true, threads };

  let rows;
  try {
    rows = await prisma.followUpMessage.findMany({
      where: { appointmentId: { in: relevant.map((a) => a.id) } },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        appointmentId: true,
        authorId: true,
        body: true,
        createdAt: true,
        author: { select: { name: true } },
        document: { select: { id: true, title: true } },
      },
    });
  } catch (error) {
    if (isMissingTable(error)) return { available: false, threads };
    throw error;
  }

  for (const appointment of relevant) {
    const closesAt = followUpClosesAt(appointment);
    threads.set(appointment.id, {
      appointmentId: appointment.id,
      closesAt: closesAt?.toISOString() ?? null,
      open: closesAt !== null && closesAt.getTime() > now,
      messages: rows
        .filter((row) => row.appointmentId === appointment.id)
        .map((row) => {
          const fromVet = row.authorId === appointment.vetProfile.userId;
          return {
            id: row.id,
            body: row.body,
            createdAt: row.createdAt.toISOString(),
            authorName: row.author.name ?? (fromVet ? "Vet" : "Owner"),
            fromVet,
            mine: row.authorId === viewerId,
            photo: row.document
              ? { documentId: row.document.id, title: row.document.title }
              : null,
          };
        }),
    });
  }

  return { available: true, threads };
}
