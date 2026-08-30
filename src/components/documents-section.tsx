import { uploadPetDocument, deletePetDocument } from "@/app/pets/[id]/document-actions";

const field = "w-full rounded-md border border-gray-300 px-3 py-2 text-sm";

const KIND_LABELS: Record<string, string> = {
  LAB_REPORT: "Lab report",
  PRESCRIPTION: "Prescription",
  IMAGING: "Imaging",
  VACCINATION_CERT: "Vaccination certificate",
  CONSULTATION_SNAPSHOT: "Consultation snapshot",
  OTHER: "Other",
};

export type DocumentRow = {
  id: string;
  kind: string;
  title: string;
  note: string | null;
  contentType: string;
  sizeBytes: number;
  createdAt: string;
  uploadedByName: string | null;
  canDelete: boolean;
};

function sizeLabel(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function DocumentsSection({
  petId,
  documents,
  canUpload,
}: {
  petId: string;
  documents: DocumentRow[];
  canUpload: boolean;
}) {
  return (
    <section className="rounded-lg border border-gray-200 p-5">
      <h2 className="mb-4 font-medium">Documents</h2>

      {documents.length === 0 ? (
        <p className="text-sm text-gray-400">Nothing uploaded yet.</p>
      ) : (
        <ul className="divide-y divide-gray-100">
          {documents.map((d) => (
            <li key={d.id} className="flex items-start justify-between gap-4 py-3">
              <div className="min-w-0">
                <a
                  href={`/api/documents/${d.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm font-medium hover:underline"
                >
                  {d.title}
                </a>
                <p className="text-xs text-gray-500">
                  {KIND_LABELS[d.kind] ?? d.kind}
                  {" · "}
                  {sizeLabel(d.sizeBytes)}
                  {" · "}
                  {d.createdAt}
                  {d.uploadedByName && ` · ${d.uploadedByName}`}
                </p>
                {d.note && <p className="mt-1 text-xs text-gray-600">{d.note}</p>}
              </div>
              {d.canDelete && (
                <form action={deletePetDocument}>
                  <input type="hidden" name="id" value={d.id} />
                  <button type="submit" className="text-xs text-red-600 hover:underline">
                    Remove
                  </button>
                </form>
              )}
            </li>
          ))}
        </ul>
      )}

      {canUpload && (
        <form action={uploadPetDocument} className="mt-5 grid gap-3">
          <input type="hidden" name="petId" value={petId} />
          <div className="flex flex-wrap items-end gap-3">
            <div className="w-52">
              <label className="mb-1 block text-xs text-gray-600" htmlFor="file">
                File (PDF or image, max 10 MB)
              </label>
              <input
                id="file"
                name="file"
                type="file"
                accept="application/pdf,image/jpeg,image/png,image/webp"
                className="w-full text-sm"
                required
              />
            </div>
            <div className="w-44">
              <label className="mb-1 block text-xs text-gray-600" htmlFor="kind">
                Type
              </label>
              <select id="kind" name="kind" className={field} defaultValue="LAB_REPORT">
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
              <input id="title" name="title" className={field} placeholder="Blood panel, March" />
            </div>
            <button
              type="submit"
              className="rounded-md bg-gray-900 px-4 py-2 text-sm text-white hover:bg-gray-700"
            >
              Upload
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
