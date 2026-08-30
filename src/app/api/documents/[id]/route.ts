import { NextResponse } from "next/server";
import { auth } from "@/../auth";
import { prisma } from "@/lib/prisma";
import { getPetAccess } from "@/lib/pet-access";
import { getSignedReadUrl } from "@/lib/blob";

/**
 * Hands out a short-lived link to one document, after checking that the
 * requester is entitled to it.
 *
 * The stored blob is private, so this route is the only way in. It does
 * not stream the file — it checks access, mints a five-minute signed URL,
 * and redirects. That keeps large files off the serverless function's
 * data path while leaving the authorisation decision on the server.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const document = await prisma.document.findUnique({
    where: { id },
    select: { petId: true, pathname: true },
  });

  // A missing document and an inaccessible one return the same 404.
  // Distinguishing them would confirm to a stranger that a given id
  // exists, which is more than they need to know.
  if (!document) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const access = await getPetAccess(document.petId, session.user.id);
  if (!access) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const url = await getSignedReadUrl(document.pathname);
  return NextResponse.redirect(url);
}
