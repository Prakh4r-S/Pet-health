"use client";

import { useRef, useState } from "react";
import { registerPetDocument } from "@/app/pets/[id]/document-actions";
import { uploadDirect } from "@/lib/client-upload";
import { ALLOWED_CONTENT_TYPES, MAX_UPLOAD_BYTES } from "@/lib/upload-rules";

const field = "w-full rounded-md border border-gray-300 px-3 py-2 text-sm";

type State =
  | { phase: "idle" }
  | { phase: "uploading"; percentage: number }
  | { phase: "saving" }
  | { phase: "error"; message: string };

/**
 * Uploads a document in two steps: the file goes from the browser
 * directly to the blob store, then a server action records it against
 * the pet. Sending the file through the action itself would cap it at
 * the request body limit, far below the 10 MB this form promises.
 */
export default function DocumentUploadForm({ petId }: { petId: string }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, setState] = useState<State>({ phase: "idle" });
  const busy = state.phase === "uploading" || state.phase === "saving";

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busy) return;

    const data = new FormData(event.currentTarget);
    const file = data.get("file");

    // Checked here so a wrong file fails immediately rather than after
    // the upload. The server enforces the same limits regardless.
    if (!(file instanceof File) || file.size === 0) {
      setState({ phase: "error", message: "Choose a file." });
      return;
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      setState({ phase: "error", message: "File must be under 10 MB." });
      return;
    }
    if (!ALLOWED_CONTENT_TYPES.includes(file.type)) {
      setState({ phase: "error", message: "Only PDF and image files are accepted." });
      return;
    }

    setState({ phase: "uploading", percentage: 0 });

    try {
      const pathname = await uploadDirect({
        file,
        filename: file.name,
        contentType: file.type,
        request: { kind: "document", petId },
        // A late progress event must not drag the form back out of a
        // later phase.
        onProgress: (percentage) =>
          setState((s) => (s.phase === "uploading" ? { phase: "uploading", percentage } : s)),
      });

      setState({ phase: "saving" });

      const result = await registerPetDocument({
        petId,
        pathname,
        title: String(data.get("title") ?? "").trim() || file.name,
        kind: String(data.get("kind") ?? "OTHER"),
      });

      if (!result.ok) {
        setState({ phase: "error", message: result.error });
        return;
      }

      formRef.current?.reset();
      setState({ phase: "idle" });
    } catch {
      setState({ phase: "error", message: "Upload failed. Check your connection and try again." });
    }
  };

  return (
    <form ref={formRef} onSubmit={onSubmit} className="mt-5 grid gap-3">
      <div className="flex flex-wrap items-end gap-3">
        <div className="w-52">
          <label className="mb-1 block text-xs text-gray-600" htmlFor="file">
            File (PDF or image, max 10 MB)
          </label>
          <input
            id="file"
            name="file"
            type="file"
            accept={ALLOWED_CONTENT_TYPES.join(",")}
            className="w-full text-sm"
            disabled={busy}
            required
          />
        </div>
        <div className="w-44">
          <label className="mb-1 block text-xs text-gray-600" htmlFor="kind">
            Type
          </label>
          <select
            id="kind"
            name="kind"
            className={field}
            defaultValue="LAB_REPORT"
            disabled={busy}
          >
            <option value="LAB_REPORT">Lab report</option>
            <option value="PRESCRIPTION">Prescription</option>
            <option value="IMAGING">Imaging</option>
            <option value="VACCINATION_CERT">Vaccination certificate</option>
            <option value="OTHER">Other</option>
          </select>
        </div>
        <div className="min-w-44 flex-1">
          <label className="mb-1 block text-xs text-gray-600" htmlFor="title">
            Title (optional)
          </label>
          <input
            id="title"
            name="title"
            className={field}
            placeholder="Blood panel, March"
            maxLength={200}
            disabled={busy}
          />
        </div>
        <button
          type="submit"
          disabled={busy}
          className="rounded-md bg-pine-900 px-4 py-2 text-sm text-white hover:bg-pine-700 disabled:bg-gray-300"
        >
          {state.phase === "uploading"
            ? `Uploading ${Math.round(state.percentage)}%`
            : state.phase === "saving"
              ? "Saving..."
              : "Upload"}
        </button>
      </div>

      {state.phase === "error" && (
        <p role="alert" className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-900">
          {state.message}
        </p>
      )}
    </form>
  );
}
