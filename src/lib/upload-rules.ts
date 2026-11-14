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

/** Profile and clinic photos. Smaller than documents: these are shown, not archived. */
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];

/**
 * What a photo is of. It decides where the file is stored and, for a
 * pet's photo, whose permission is needed.
 */
export const IMAGE_PURPOSES = ["user-avatar", "pet-photo", "vet-avatar", "clinic-photo"] as const;
export type ImagePurpose = (typeof IMAGE_PURPOSES)[number];

export type ImageUploadRequest =
  // No petId while the pet is still being added: there is nothing to own yet.
  | { kind: "image"; purpose: "pet-photo"; petId?: string }
  | { kind: "image"; purpose: Exclude<ImagePurpose, "pet-photo"> };

/** What MediaRecorder produces: webm on Chromium and Firefox, mp4 on Safari. */
export const ALLOWED_RECORDING_TYPES = ["audio/webm", "audio/mp4"];

/**
 * What the browser sends to /api/upload alongside the pathname, so the
 * route knows which access rule to apply before issuing a token.
 */
export type UploadRequest =
  | { kind: "document"; petId: string }
  | { kind: "recording"; appointmentId: string }
  | ImageUploadRequest;

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

/**
 * Photos are public, unlike everything above, and sit under a prefix of
 * their own so that nothing meant to be private can share a path with
 * them.
 */
export function imagePrefix(request: ImageUploadRequest) {
  return request.purpose === "pet-photo"
    ? `images/pet-photo/${request.petId ?? "new"}/`
    : `images/${request.purpose}/`;
}

/**
 * Whether a URL is one of our uploaded photos. A form field carrying a
 * photo URL is user input like any other: a server action should check
 * it with this before storing it, or anyone could save a link to
 * somewhere else entirely.
 */
export function isUploadedImageUrl(value: string) {
  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      url.hostname.endsWith(".public.blob.vercel-storage.com") &&
      url.pathname.startsWith("/images/")
    );
  } catch {
    return false;
  }
}

/**
 * Reads a photo field from a submitted form.
 *
 * `undefined` means the form had no such field and the stored photo
 * should be left alone; `null` means the photo was removed; `false`
 * means the value is not one of our uploads and should be refused.
 */
export function parseImageField(value: FormDataEntryValue | null) {
  if (value === null) return undefined;
  const url = String(value).trim();
  if (!url) return null;
  return isUploadedImageUrl(url) ? url : false;
}

export function safeFilename(filename: string) {
  return filename.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 80) || "file";
}

/** "audio/webm;codecs=opus" -> "audio/webm" */
export function baseContentType(contentType: string) {
  return contentType.split(";")[0].trim().toLowerCase();
}
