/**
 * Upload limits and path conventions, shared by the browser (to reject a
 * file before sending it) and the server (which is what actually enforces
 * them). No server-only imports here — client components read this file.
 */

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
export const MAX_RECORDING_BYTES = 60 * 1024 * 1024;

export const ALLOWED_CONTENT_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
];

/** What MediaRecorder produces: webm on Chromium and Firefox, mp4 on Safari. */
export const ALLOWED_RECORDING_TYPES = ["audio/webm", "audio/mp4"];

/**
 * What the browser sends to /api/upload alongside the pathname, so the
 * route knows which access rule to apply before issuing a token.
 */
export type UploadRequest =
  | { kind: "document"; petId: string }
  | { kind: "recording"; appointmentId: string };

/**
 * Documents and recordings live under different prefixes on purpose. An
 * owner can register any blob under their pet's prefix as a document, so
 * a vet's consultation audio must not sit there too.
 */
export function documentPrefix(petId: string) {
  return `pets/${petId}/`;
}

export function recordingPrefix(appointmentId: string) {
  return `recordings/${appointmentId}/`;
}

export function safeFilename(filename: string) {
  return filename.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 80) || "file";
}

/** "audio/webm;codecs=opus" -> "audio/webm" */
export function baseContentType(contentType: string) {
  return contentType.split(";")[0].trim().toLowerCase();
}
