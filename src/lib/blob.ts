import { put, del, head, issueSignedToken, presignUrl } from "@vercel/blob";
import { documentPrefix, safeFilename } from "@/lib/upload-rules";

export {
  MAX_UPLOAD_BYTES,
  MAX_RECORDING_BYTES,
  ALLOWED_CONTENT_TYPES,
  ALLOWED_RECORDING_TYPES,
} from "@/lib/upload-rules";

/** Signed read links are deliberately short-lived. */
const READ_URL_TTL_MS = 5 * 60 * 1000;

/**
 * Server-side upload, for bytes the server already holds (an annotated
 * snapshot). Files chosen in the browser do not come through here — they
 * go straight to the blob store with a token from /api/upload, because a
 * request body through a server action or a serverless function is capped
 * well below the size of a scan or a recording.
 */
export async function uploadDocument(params: {
  petId: string;
  filename: string;
  contentType: string;
  body: Buffer | ArrayBuffer;
}) {
  const pathname = `${documentPrefix(params.petId)}${Date.now()}-${safeFilename(params.filename)}`;

  const blob = await put(pathname, params.body, {
    access: "private",
    contentType: params.contentType,
    addRandomSuffix: true,
  });

  return { pathname: blob.pathname, url: blob.url };
}

/** How long to wait for the store to confirm an upload before giving up. */
const INSPECT_TIMEOUT_MS = 10_000;

/**
 * What the blob store actually holds at a pathname, or null if that
 * could not be established.
 *
 * After a direct upload the browser tells the server where the file went.
 * That report is a claim, not a fact: size and content type are read back
 * from the store here rather than taken from the client.
 *
 * The SDK retries an unreachable store for a long time before failing, so
 * the wait is capped here — the person watching "Saving..." should get an
 * answer either way.
 */
export async function inspectBlob(pathname: string) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<null>((resolve) => {
    timer = setTimeout(() => resolve(null), INSPECT_TIMEOUT_MS);
  });

  try {
    const blob = await Promise.race([head(pathname), timeout]);
    if (!blob) return null;
    return {
      pathname: blob.pathname,
      contentType: blob.contentType,
      sizeBytes: blob.size,
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export async function getSignedReadUrl(pathname: string): Promise<string> {
  const token = await issueSignedToken({ operations: ["get"] });

  const { presignedUrl } = await presignUrl(token, {
    pathname,
    operation: "get",
    access: "private",
    validUntil: Date.now() + READ_URL_TTL_MS,
  });

  return presignedUrl;
}

export async function deleteDocument(pathname: string) {
  await del(pathname);
}
