import ActionForm from "@/components/action-form";
import SubmitButton from "@/components/submit-button";
import { archivePet, updatePet } from "@/app/pets/[id]/actions";

const field = "w-full rounded-md border border-mist-deep px-3 py-2 text-sm";
const label = "mb-1 block text-xs text-bark-soft";

export type EditablePet = {
  id: string;
  name: string;
  speciesName: string;
  breedId: string | null;
  breedFreeText: string | null;
  sex: string;
  neutered: boolean | null;
  microchipNumber: string | null;
  birthDate: string | null;
  birthDateIsApprox: boolean;
};

/**
 * Edit and archive, folded away behind a disclosure.
 *
 * These are occasional tasks on a page that is mostly for reading, so
 * they stay out of the way until asked for. A native <details> does that
 * without any script, and keeps working if the page's JavaScript has not
 * loaded.
 */
export default function PetEditForm({
  pet,
  breeds,
}: {
  pet: EditablePet;
  breeds: { id: string; name: string }[];
}) {
  return (
    <details className="group mb-6 rounded-lg border border-mist">
      <summary className="cursor-pointer select-none px-5 py-3 text-sm font-medium text-pine-700 hover:text-pine-900">
        Edit details
      </summary>

      <div className="border-t border-mist p-5">
        <ActionForm
          action={updatePet}
          resetOnSuccess={false}
          successMessage="Details saved."
          className="grid gap-4 sm:grid-cols-2"
        >
          <input type="hidden" name="petId" value={pet.id} />

          <div>
            <label className={label} htmlFor="pet-name">Name</label>
            <input
              id="pet-name"
              name="name"
              className={field}
              defaultValue={pet.name}
              maxLength={80}
              required
            />
          </div>

          <div>
            <label className={label} htmlFor="pet-sex">Sex</label>
            <select id="pet-sex" name="sex" className={field} defaultValue={pet.sex}>
              <option value="UNKNOWN">Unknown</option>
              <option value="MALE">Male</option>
              <option value="FEMALE">Female</option>
            </select>
          </div>

          <div>
            <label className={label} htmlFor="pet-breed">Breed ({pet.speciesName})</label>
            <select
              id="pet-breed"
              name="breedId"
              className={field}
              defaultValue={pet.breedId ?? ""}
            >
              <option value="">Unknown or mixed</option>
              {breeds.map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className={label} htmlFor="pet-breed-text">Or describe the mix</label>
            <input
              id="pet-breed-text"
              name="breedFreeText"
              className={field}
              defaultValue={pet.breedFreeText ?? ""}
              placeholder="Labrador x Indie"
            />
          </div>

          <div>
            <label className={label} htmlFor="pet-birth">Date of birth</label>
            <input
              id="pet-birth"
              name="birthDate"
              type="date"
              className={field}
              defaultValue={pet.birthDate ?? ""}
            />
            <label className="mt-2 flex items-center gap-2 text-xs text-bark-soft">
              <input
                type="checkbox"
                name="birthDateIsApprox"
                defaultChecked={pet.birthDateIsApprox}
              />
              This date is an estimate
            </label>
          </div>

          <div>
            <label className={label} htmlFor="pet-neutered">Neutered</label>
            <select
              id="pet-neutered"
              name="neutered"
              className={field}
              defaultValue={pet.neutered === true ? "yes" : pet.neutered === false ? "no" : ""}
            >
              <option value="">Not recorded</option>
              <option value="yes">Yes</option>
              <option value="no">No</option>
            </select>
          </div>

          <div className="sm:col-span-2">
            <label className={label} htmlFor="pet-microchip">Microchip number</label>
            <input
              id="pet-microchip"
              name="microchipNumber"
              className={field}
              defaultValue={pet.microchipNumber ?? ""}
              maxLength={40}
              inputMode="numeric"
            />
          </div>

          <div className="sm:col-span-2">
            <SubmitButton pendingLabel="Saving...">Save details</SubmitButton>
          </div>
        </ActionForm>

        <div className="mt-6 border-t border-mist pt-5">
          <h3 className="text-sm font-medium">Archive {pet.name}</h3>
          <p className="mt-1 text-xs text-bark-soft">
            Removes {pet.name} from your list. Consultation records are kept, but
            you won&apos;t be able to open this page or book appointments for{" "}
            {pet.name} afterwards.
          </p>
          <ActionForm
            action={archivePet}
            className="mt-3"
            confirm={`Archive ${pet.name}? They will disappear from your pets, and this can't be undone from the app.`}
          >
            <input type="hidden" name="petId" value={pet.id} />
            <SubmitButton
              pendingLabel="Archiving..."
              className="rounded-md border border-red-200 px-3 py-1.5 text-sm text-red-700 hover:bg-red-50"
            >
              Archive pet
            </SubmitButton>
          </ActionForm>
        </div>
      </div>
    </details>
  );
}
