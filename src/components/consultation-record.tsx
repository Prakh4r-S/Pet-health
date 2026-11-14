import LocalTime from "@/components/local-time";
import type { ConsultationRecord } from "@/lib/consultation-records";

function Field({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;
  return (
    <div>
      <dt className="text-xs font-medium text-ink-soft">{label}</dt>
      <dd className="mt-0.5 whitespace-pre-wrap text-sm">{value}</dd>
    </div>
  );
}

/**
 * A finalised consultation record, read-only, as the owner sees it.
 *
 * Prescriptions come first: "what am I supposed to give, and how often"
 * is the question an owner opens this to answer. Amendments are shown as
 * separate dated entries beneath the note rather than merged into it,
 * because that is what they are — the note itself never changes.
 */
export default function ConsultationRecordView({ record }: { record: ConsultationRecord }) {
  return (
    <div className="grid gap-4">
      {record.prescriptions.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold uppercase tracking-wide text-navy-700">
            Prescribed
          </h4>
          <ul className="mt-1.5 grid gap-2">
            {record.prescriptions.map((p) => (
              <li key={p.id} className="rounded-md bg-aqua-50 px-3 py-2">
                <p className="text-sm font-medium">{p.drug}</p>
                <p className="text-sm text-ink">
                  {p.dose} · {p.frequency}
                  {p.durationDays != null && ` · ${p.durationDays} days`}
                </p>
                {p.instructions && (
                  <p className="mt-0.5 text-xs text-ink-soft">{p.instructions}</p>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      <dl className="grid gap-3">
        <Field label="Presenting complaint" value={record.presentingComplaint} />
        <Field label="Examination" value={record.examination} />
        <Field label="Assessment" value={record.assessment} />
        <Field label="Plan" value={record.plan} />
        <Field label="Follow up on" value={record.followUpOn} />
        <Field label="Follow-up recommendation" value={record.followUpNote} />
      </dl>

      {record.amendments.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold uppercase tracking-wide text-ink-soft">
            Added later by the vet
          </h4>
          <ul className="mt-1.5 grid gap-2">
            {record.amendments.map((a) => (
              <li key={a.id} className="rounded-md border border-mist p-3">
                <p className="whitespace-pre-wrap text-sm">{a.body}</p>
                <p className="mt-1 text-xs text-ink-soft">
                  {a.authorName ?? "Vet"} · <LocalTime date={a.createdAt} format="dayTime" />
                </p>
              </li>
            ))}
          </ul>
        </div>
      )}

      {record.finalisedAt && (
        <p className="text-xs text-ink-soft">
          Record finalised <LocalTime date={record.finalisedAt} format="dayTime" />
        </p>
      )}
    </div>
  );
}
