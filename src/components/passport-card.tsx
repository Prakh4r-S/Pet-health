import ActionForm from "@/components/action-form";
import SubmitButton from "@/components/submit-button";
import PassportLink from "@/components/passport-link";
import {
  revokePassport,
  savePassportContact,
  sharePassport,
} from "@/app/pets/[id]/actions";

const field = "w-full rounded-md border border-mist-deep px-3 py-2 text-sm";

/**
 * The owner's controls for the public health passport.
 *
 * Sharing is off until the owner turns it on, and the card says in plain
 * terms what turning it on means: anyone with the link can read the
 * summary, no account needed. That is the point of it — and the reason
 * replacing and revoking the link sit right beside it.
 */
export default function PassportCard({
  petId,
  petName,
  passport,
}: {
  petId: string;
  petName: string;
  passport: { token: string; contactNote: string | null; createdAt: string } | null;
}) {
  return (
    <section className="mb-6 rounded-lg border border-mist p-5">
      <h2 className="font-medium">Share health passport</h2>
      <p className="mt-1 text-sm text-ink-soft">
        A read-only page with {petName}&apos;s allergies, ongoing conditions, current
        medication, vaccinations and basic details — for a sitter, groomer or
        emergency vet. Documents, consultation notes and your email address are
        never included.
      </p>

      {!passport ? (
        <ActionForm action={sharePassport} className="mt-4">
          <input type="hidden" name="petId" value={petId} />
          <SubmitButton pendingLabel="Creating link...">Create share link</SubmitButton>
          <p className="mt-2 text-xs text-ink-soft">
            Anyone you give the link to can open it without signing in. You can
            turn it off at any time.
          </p>
        </ActionForm>
      ) : (
        <div className="mt-4 grid gap-5">
          <div>
            <PassportLink path={`/passport/${passport.token}`} />
            <p className="text-xs text-ink-soft">
              Shared since {passport.createdAt}. Anyone with this link can view the
              passport without signing in.
            </p>
          </div>

          <ActionForm
            action={savePassportContact}
            resetOnSuccess={false}
            successMessage="Contact note saved."
            className="grid gap-2"
          >
            <input type="hidden" name="petId" value={petId} />
            <label className="text-xs text-ink-soft" htmlFor="passport-contact">
              How to reach you (shown on the passport, optional)
            </label>
            <textarea
              id="passport-contact"
              name="contactNote"
              rows={2}
              maxLength={300}
              className={field}
              defaultValue={passport.contactNote ?? ""}
              placeholder="Call or text 98765 43210. Usual vet: Riverside Clinic."
            />
            <SubmitButton
              pendingLabel="Saving..."
              className="w-fit rounded-md border border-mist px-3 py-1.5 text-sm text-navy-900 hover:bg-aqua-50"
            >
              Save contact note
            </SubmitButton>
          </ActionForm>

          <div className="flex flex-wrap items-start gap-x-6 gap-y-2 border-t border-mist pt-4">
            <ActionForm
              action={sharePassport}
              confirm="Replace the link? The current link will stop working immediately, and anyone you gave it to will need the new one."
            >
              <input type="hidden" name="petId" value={petId} />
              <SubmitButton
                pendingLabel="Replacing..."
                className="text-sm text-navy-700 hover:underline"
              >
                Replace link
              </SubmitButton>
            </ActionForm>
            <ActionForm
              action={revokePassport}
              confirm="Stop sharing? The link will stop working immediately."
            >
              <input type="hidden" name="petId" value={petId} />
              <SubmitButton
                pendingLabel="Turning off..."
                className="text-sm text-red-600 hover:underline"
              >
                Stop sharing
              </SubmitButton>
            </ActionForm>
          </div>
        </div>
      )}
    </section>
  );
}
