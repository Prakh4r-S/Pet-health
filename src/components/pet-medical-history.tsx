import ActionForm from "@/components/action-form";
import SubmitButton from "@/components/submit-button";
import {
  addAllergy,
  addCondition,
  removeAllergy,
  removeCondition,
  resolveCondition,
} from "@/app/pets/[id]/actions";

const field = "w-full rounded-md border border-mist-deep px-3 py-2 text-sm";
const label = "mb-1 block text-xs text-ink-soft";
const textButton = "text-xs hover:underline";

const severityStyles: Record<string, { text: string; className: string }> = {
  SEVERE: { text: "severe", className: "bg-red-100 text-red-800" },
  MODERATE: { text: "moderate", className: "bg-amber-100 text-amber-800" },
  MILD: { text: "mild", className: "bg-mist text-ink" },
};

export type AllergyRow = {
  id: string;
  allergen: string;
  reaction: string | null;
  severity: string;
};

export type ConditionRow = {
  id: string;
  name: string;
  notes: string | null;
  diagnosedOn: string | null;
  resolvedOn: string | null;
};

/**
 * Allergies and conditions, with the forms to maintain them.
 *
 * The owner keeps these; a treating vet reads them. Both matter most to
 * the vet — an allergy is what changes a prescribing decision — so this
 * is the section worth making easy to keep current.
 */
export default function PetMedicalHistory({
  petId,
  canEdit,
  allergies,
  conditions,
}: {
  petId: string;
  canEdit: boolean;
  allergies: AllergyRow[];
  conditions: ConditionRow[];
}) {
  return (
    <section className="mb-6 rounded-lg border border-mist p-5">
      <h2 className="mb-4 font-medium">Medical history</h2>

      <h3 className="text-sm font-medium">Allergies</h3>
      {allergies.length === 0 ? (
        <p className="mt-1 text-sm text-ink-faint">None recorded.</p>
      ) : (
        <ul className="mt-1 divide-y divide-mist">
          {allergies.map((a) => {
            const severity = severityStyles[a.severity];
            return (
              <li key={a.id} className="flex items-start justify-between gap-4 py-2.5">
                <div className="text-sm">
                  <span className="font-medium">{a.allergen}</span>
                  {severity && (
                    <span className={`ml-2 rounded-full px-2 py-0.5 text-xs ${severity.className}`}>
                      {severity.text}
                    </span>
                  )}
                  {a.reaction && <p className="text-xs text-ink-soft">{a.reaction}</p>}
                </div>
                {canEdit && (
                  <ActionForm
                    action={removeAllergy}
                    className="shrink-0 text-right"
                    confirm={`Remove ${a.allergen} from the allergy list? Vets will no longer be warned about it.`}
                  >
                    <input type="hidden" name="petId" value={petId} />
                    <input type="hidden" name="id" value={a.id} />
                    <SubmitButton pendingLabel="Removing..." className={`${textButton} text-red-600`}>
                      Remove
                    </SubmitButton>
                  </ActionForm>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {canEdit && (
        <details className="mt-2">
          <summary className="cursor-pointer select-none text-sm text-navy-700 hover:text-navy-900">
            Add an allergy
          </summary>
          <ActionForm action={addAllergy} className="mt-3 flex flex-wrap items-end gap-3">
            <input type="hidden" name="petId" value={petId} />
            <div className="w-44">
              <label className={label} htmlFor="allergy-allergen">Allergic to</label>
              <input
                id="allergy-allergen"
                name="allergen"
                className={field}
                placeholder="Penicillin"
                maxLength={120}
                required
              />
            </div>
            <div className="min-w-44 flex-1">
              <label className={label} htmlFor="allergy-reaction">Reaction (optional)</label>
              <input
                id="allergy-reaction"
                name="reaction"
                className={field}
                placeholder="Hives, facial swelling"
              />
            </div>
            <div className="w-36">
              <label className={label} htmlFor="allergy-severity">Severity</label>
              <select
                id="allergy-severity"
                name="severity"
                className={field}
                defaultValue="UNKNOWN"
              >
                <option value="UNKNOWN">Not sure</option>
                <option value="MILD">Mild</option>
                <option value="MODERATE">Moderate</option>
                <option value="SEVERE">Severe</option>
              </select>
            </div>
            <SubmitButton pendingLabel="Adding...">Add</SubmitButton>
          </ActionForm>
        </details>
      )}

      <h3 className="mt-6 text-sm font-medium">Conditions</h3>
      {conditions.length === 0 ? (
        <p className="mt-1 text-sm text-ink-faint">None recorded.</p>
      ) : (
        <ul className="mt-1 divide-y divide-mist">
          {conditions.map((c) => (
            <li key={c.id} className="flex items-start justify-between gap-4 py-2.5">
              <div className="text-sm">
                <span className="font-medium">{c.name}</span>
                <span className="text-ink-soft">
                  {c.resolvedOn ? ` · resolved ${c.resolvedOn}` : " · ongoing"}
                  {c.diagnosedOn && ` · diagnosed ${c.diagnosedOn}`}
                </span>
                {c.notes && <p className="whitespace-pre-wrap text-xs text-ink-soft">{c.notes}</p>}
              </div>
              {canEdit && (
                <div className="flex shrink-0 flex-col items-end gap-1">
                  {!c.resolvedOn && (
                    <ActionForm action={resolveCondition} className="text-right">
                      <input type="hidden" name="petId" value={petId} />
                      <input type="hidden" name="id" value={c.id} />
                      <SubmitButton
                        pendingLabel="Saving..."
                        className={`${textButton} text-navy-700`}
                      >
                        Mark resolved
                      </SubmitButton>
                    </ActionForm>
                  )}
                  <ActionForm
                    action={removeCondition}
                    className="text-right"
                    confirm={`Remove ${c.name} from the record entirely? If it has cleared up, use "Mark resolved" instead so the history is kept.`}
                  >
                    <input type="hidden" name="petId" value={petId} />
                    <input type="hidden" name="id" value={c.id} />
                    <SubmitButton pendingLabel="Removing..." className={`${textButton} text-red-600`}>
                      Remove
                    </SubmitButton>
                  </ActionForm>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {canEdit && (
        <details className="mt-2">
          <summary className="cursor-pointer select-none text-sm text-navy-700 hover:text-navy-900">
            Add a condition
          </summary>
          <ActionForm action={addCondition} className="mt-3 flex flex-wrap items-end gap-3">
            <input type="hidden" name="petId" value={petId} />
            <div className="w-48">
              <label className={label} htmlFor="condition-name">Condition</label>
              <input
                id="condition-name"
                name="name"
                className={field}
                placeholder="Hip dysplasia"
                maxLength={120}
                required
              />
            </div>
            <div className="w-44">
              <label className={label} htmlFor="condition-diagnosed">Diagnosed (optional)</label>
              <input id="condition-diagnosed" name="diagnosedOn" type="date" className={field} />
            </div>
            <div className="min-w-44 flex-1">
              <label className={label} htmlFor="condition-notes">Notes (optional)</label>
              <input id="condition-notes" name="notes" className={field} />
            </div>
            <SubmitButton pendingLabel="Adding...">Add</SubmitButton>
          </ActionForm>
        </details>
      )}
    </section>
  );
}
