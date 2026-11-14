import { upload } from "@vercel/blob/client";
import {
  documentPrefix,
  imagePrefix,
  recordingPrefix,
  safeFilename,
  type ImageUploadRequest,
  type UploadRequest,
} from "@/lib/upload-rules";

/** Above this, the file is sent in parts so one dropped connection does not restart it. */
const MULTIPART_THRESHOLD_BYTES = 8 * 1024 * 1024;

/**
 * Sends a file from the browser straight to the blob store and returns
 * the pathname it was stored under.
 *
 * /api/upload decides whether this is allowed and issues a token bound to
 * the path; the bytes then bypass the application entirely. The returned
 * pathname still has to be handed to a server action to become a record.
 */
export async function uploadDirect(params: {
  file: Blob;
  filename: string;
  contentType: string;
  request: Exclude<UploadRequest, ImageUploadRequest>;
  onProgress?: (percentage: number) => void;
}): Promise<string> {
  const { file, filename, contentType, request, onProgress } = params;

  const prefix =
    request.kind === "document"
      ? documentPrefix(request.petId)
      : recordingPrefix(request.appointmentId);

  const blob = await upload(`${prefix}${Date.now()}-${safeFilename(filename)}`, file, {
    access: "private",
    handleUploadUrl: "/api/upload",
    clientPayload: JSON.stringify(request),
    contentType,
    multipart: file.size > MULTIPART_THRESHOLD_BYTES,
    onUploadProgress: onProgress ? (e) => onProgress(e.percentage) : undefined,
  });

  return blob.pathname;
}

/**
 * Sends a photo to the public blob store and returns its URL.
 *
 * Unlike a document, a photo is meant to be seen by other people — a vet
 * listing shows it to anyone browsing — so it is stored publicly and
 * referred to by URL rather than by a pathname that needs signing.
 */
export async function uploadImage(params: {
  file: File;
  request: ImageUploadRequest;
  onProgress?: (percentage: number) => void;
  abortSignal?: AbortSignal;
}): Promise<string> {
  const { file, request, onProgress, abortSignal } = params;

  const blob = await upload(`${imagePrefix(request)}${safeFilename(file.name)}`, file, {
    access: "public",
    handleUploadUrl: "/api/upload",
    clientPayload: JSON.stringify(request),
    contentType: file.type,
    onUploadProgress: onProgress ? (e) => onProgress(e.percentage) : undefined,
    abortSignal,
  });

  return blob.url;
}
