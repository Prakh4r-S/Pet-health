import { deletePetDocument } from "@/app/pets/[id]/document-actions";
import DocumentUploadForm from "@/components/document-upload-form";

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

      {canUpload && <DocumentUploadForm petId={petId} />}
    </section>
  );
}
