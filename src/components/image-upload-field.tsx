"use client";

import { useEffect, useId, useRef, useState } from "react";
import Image from "next/image";
import { uploadImage } from "@/lib/client-upload";
import {
  ALLOWED_IMAGE_TYPES,
  MAX_IMAGE_BYTES,
  isUploadedImageUrl,
  type ImageUploadRequest,
} from "@/lib/upload-rules";

type Upload =
  | { phase: "idle" }
  | { phase: "uploading"; percentage: number; previewUrl: string }
  | { phase: "error"; message: string };

const button =
  "rounded-md border border-mist-deep px-3 py-1.5 text-sm text-navy-700 hover:text-navy-900 disabled:cursor-not-allowed disabled:opacity-60";

/**
 * A photo field for a form: pick an image, see it, and have its URL
 * submitted with everything else.
 *
 * The photo is uploaded as soon as it is chosen, straight to the blob
 * store with a token from /api/upload, and what the form carries is a
 * hidden input holding the resulting URL — so the surrounding form and
 * its server action deal in a string, not a file. The action should
 * check that string with `isUploadedImageUrl` before storing it.
 *
 * Two shapes: `avatar`, a circle for a person's, pet's or vet's photo,
 * and `banner`, a wide card for a clinic or hospital.
 *
 * Removing or replacing a photo only changes the field. The old file is
 * left in the store, because until the form is saved the old URL is
 * still what the database holds.
 */
export default function ImageUploadField({
  name,
  label,
  request,
  variant = "avatar",
  defaultValue = null,
  fallbackUrl = null,
  alt = "",
  onUploadingChange,
}: {
  /** Name of the hidden input that carries the photo's URL. Empty string means no photo. */
  name: string;
  label: string;
  /** What the photo is of, which decides who may upload it and where it is stored. */
  request: ImageUploadRequest;
  variant?: "avatar" | "banner";
  /** The photo already saved, if any. */
  defaultValue?: string | null;
  /**
   * Shown while the field is empty, and never submitted — the picture a
   * sign-in provider supplied, say, which is what will appear elsewhere
   * until the user uploads their own.
   */
  fallbackUrl?: string | null;
  alt?: string;
  /** For a parent that wants to disable its own controls during an upload. */
  onUploadingChange?: (uploading: boolean) => void;
}) {
  const inputId = useId();
  const fileRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const [url, setUrl] = useState(defaultValue ?? "");
  const [upload, setUpload] = useState<Upload>({ phase: "idle" });

  const uploading = upload.phase === "uploading";
  const previewUrl = upload.phase === "uploading" ? upload.previewUrl : null;

  // A form submitted mid-upload would save the previous photo and report
  // success. Marking the file input invalid makes the browser refuse the
  // submission and say why, whatever kind of form this sits in.
  useEffect(() => {
    fileRef.current?.setCustomValidity(
      uploading ? "Wait for the photo to finish uploading." : "",
    );
    onUploadingChange?.(uploading);
  }, [uploading, onUploadingChange]);

  // The local preview is a blob: URL, which holds the file in memory
  // until released.
  useEffect(() => {
    if (!previewUrl) return;
    return () => URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  useEffect(() => () => abortRef.current?.abort(), []);

  const onFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    // Cleared so that choosing the same file again still fires a change.
    event.target.value = "";
    if (!file || uploading) return;

    // Checked here so a wrong file fails at once. The token issued by
    // /api/upload enforces the same limits regardless.
    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      setUpload({ phase: "error", message: "Choose a JPEG, PNG or WebP image." });
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      setUpload({ phase: "error", message: "Image must be under 5 MB." });
      return;
    }

    const controller = new AbortController();
    abortRef.current = controller;
    setUpload({ phase: "uploading", percentage: 0, previewUrl: URL.createObjectURL(file) });

    try {
      const uploadedUrl = await uploadImage({
        file,
        request,
        abortSignal: controller.signal,
        onProgress: (percentage) =>
          setUpload((u) => (u.phase === "uploading" ? { ...u, percentage } : u)),
      });
      if (controller.signal.aborted) return;
      setUrl(uploadedUrl);
      setUpload({ phase: "idle" });
    } catch {
      if (controller.signal.aborted) return;
      setUpload({
        phase: "error",
        message: "Upload failed. Check your connection and try again.",
      });
    }
  };

  const cancel = () => {
    abortRef.current?.abort();
    setUpload({ phase: "idle" });
  };

  const shown = previewUrl ?? (url || fallbackUrl || "");
  const frame =
    variant === "avatar"
      ? "h-24 w-24 shrink-0 rounded-full"
      : "aspect-[3/1] w-full rounded-lg";

  return (
    <div className={variant === "avatar" ? "flex items-center gap-4" : "grid gap-3"}>
      <input type="hidden" name={name} value={url} />

      <div
        className={`relative overflow-hidden border border-mist-deep bg-mist ${frame}`}
      >
        {shown ? (
          <Image
            src={shown}
            alt={alt}
            fill
            sizes={variant === "avatar" ? "96px" : "(min-width: 768px) 672px, 100vw"}
            // Only our own uploads go through the optimiser: it cannot
            // fetch a local blob: preview, and refuses any host that
            // next.config.ts does not list.
            unoptimized={!isUploadedImageUrl(shown)}
            className={`object-cover ${uploading ? "opacity-50" : ""}`}
          />
        ) : (
          <span className="absolute inset-0 flex items-center justify-center px-2 text-center text-xs text-ink-soft">
            No photo
          </span>
        )}

        {upload.phase === "uploading" && (
          <div
            role="progressbar"
            aria-label={`Uploading ${label}`}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(upload.percentage)}
            className="absolute inset-0 flex items-center justify-center bg-white/40 text-sm font-medium text-navy-900"
          >
            {Math.round(upload.percentage)}%
          </div>
        )}
      </div>

      <div className="min-w-0">
        <label className="mb-1 block text-xs text-ink-soft" htmlFor={inputId}>
          {label} (JPEG, PNG or WebP, max 5 MB)
        </label>

        {/* Visually hidden rather than display:none, and never disabled:
            the browser skips validation on a control that is either, and
            the upload-in-progress check above depends on it. */}
        <input
          ref={fileRef}
          id={inputId}
          type="file"
          accept={ALLOWED_IMAGE_TYPES.join(",")}
          onChange={onFileChange}
          className="peer sr-only"
        />

        <div className="flex flex-wrap gap-2 peer-focus-visible:[&>button:first-child]:outline peer-focus-visible:[&>button:first-child]:outline-2">
          <button
            type="button"
            className={button}
            disabled={uploading}
            aria-busy={uploading}
            onClick={() => fileRef.current?.click()}
          >
            {uploading ? "Uploading..." : url ? "Replace" : "Choose photo"}
          </button>

          {uploading ? (
            <button type="button" className={button} onClick={cancel}>
              Cancel
            </button>
          ) : (
            url && (
              <button
                type="button"
                className={button}
                onClick={() => {
                  setUrl("");
                  setUpload({ phase: "idle" });
                }}
              >
                Remove
              </button>
            )
          )}
        </div>

        {upload.phase === "error" && (
          <p role="alert" className="mt-2 text-sm text-red-900">
            {upload.message}
          </p>
        )}
      </div>
    </div>
  );
}
