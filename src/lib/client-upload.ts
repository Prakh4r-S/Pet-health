import { upload } from "@vercel/blob/client";
import {
  documentPrefix,
  recordingPrefix,
  safeFilename,
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
  request: UploadRequest;
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
