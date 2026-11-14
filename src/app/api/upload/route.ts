import { NextResponse } from "next/server";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { auth } from "@/../auth";
import { prisma } from "@/lib/prisma";
import { getPetAccess } from "@/lib/pet-access";
import {
  ALLOWED_CONTENT_TYPES,
  ALLOWED_RECORDING_TYPES,
  MAX_RECORDING_BYTES,
  MAX_UPLOAD_BYTES,
  documentPrefix,
  recordingPrefix,
  type UploadRequest,
} from "@/lib/upload-rules";

/** Long enough for a slow connection, short enough not to be a standing grant. */
const TOKEN_TTL_MS = 10 * 60 * 1000;

function parseRequest(clientPayload: string | null): UploadRequest | null {
  try {
    const value = JSON.parse(clientPayload ?? "") as Record<string, unknown>;
    if (value.kind === "document" && typeof value.petId === "string") {
      return { kind: "document", petId: value.petId };
    }
    if (value.kind === "recording" && typeof value.appointmentId === "string") {
      return { kind: "recording", appointmentId: value.appointmentId };
    }
  } catch {
    // fall through
  }
  return null;
}

/**
 * Issues a short-lived token that lets the browser upload one file
 * directly to the blob store.
 *
 * The file itself never passes through this function, which is the point:
 * a request body here is capped at a few megabytes, and a lab report or a
 * consultation recording is routinely larger. What does pass through is
 * the decision — who is asking, for which pet or appointment, and to
 * which path. The token is bound to that exact path, a size limit and a
 * set of content types, so it cannot be reused to write anywhere else.
 *
 * Nothing is recorded in the database here. The upload only becomes a
 * document or a recording when the corresponding server action is called
 * afterwards, and that action re-checks access and reads the file's real
 * size and type back from the store.
 */
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }
  const userId = session.user.id;

  let body: HandleUploadBody;
  try {
    body = (await request.json()) as HandleUploadBody;
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  // This route only issues tokens. Completion is handled by the server
  // actions, so a callback posted here has nothing to do.
  if (body.type !== "blob.generate-client-token") {
    return NextResponse.json({ error: "Unsupported request" }, { status: 400 });
  }

  try {
    const result = await handleUpload({
      request,
      body,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        const upload = parseRequest(clientPayload);
        if (!upload) throw new Error("Invalid upload request.");

        if (upload.kind === "document") {
          // Owner or treating vet, same rule as viewing the record.
          const access = await getPetAccess(upload.petId, userId);
          if (!access) throw new Error("Pet not found.");
          if (!pathname.startsWith(documentPrefix(upload.petId))) {
            throw new Error("Invalid upload path.");
          }

          return {
            allowedContentTypes: ALLOWED_CONTENT_TYPES,
            maximumSizeInBytes: MAX_UPLOAD_BYTES,
            addRandomSuffix: true,
            validUntil: Date.now() + TOKEN_TTL_MS,
          };
        }

        // Only the vet on the appointment records it.
        const appointment = await prisma.appointment.findFirst({
          where: { id: upload.appointmentId, vetProfile: { userId } },
          select: { id: true },
        });
        if (!appointment) throw new Error("Not your consultation.");
        if (!pathname.startsWith(recordingPrefix(upload.appointmentId))) {
          throw new Error("Invalid upload path.");
        }

        return {
          allowedContentTypes: ALLOWED_RECORDING_TYPES,
          maximumSizeInBytes: MAX_RECORDING_BYTES,
          addRandomSuffix: true,
          validUntil: Date.now() + TOKEN_TTL_MS,
        };
      },
    });

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Upload not allowed." },
      { status: 400 },
    );
  }
}
