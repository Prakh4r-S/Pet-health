import { put, del, issueSignedToken, presignUrl } from "@vercel/blob";

/** Signed read links are deliberately short-lived. */
const READ_URL_TTL_MS = 5 * 60 * 1000;

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

export const ALLOWED_CONTENT_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
];

export async function uploadDocument(params: {
  petId: string;
  filename: string;
  contentType: string;
  body: Buffer | ArrayBuffer;
}) {
  const safeName = params.filename.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 80);
  const pathname = `pets/${params.petId}/${Date.now()}-${safeName}`;

  const blob = await put(pathname, params.body, {
    access: "private",
    contentType: params.contentType,
    addRandomSuffix: true,
  });

  return { pathname: blob.pathname, url: blob.url };
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