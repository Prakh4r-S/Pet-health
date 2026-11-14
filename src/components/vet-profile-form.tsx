import ActionForm from "@/components/action-form";
import SubmitButton from "@/components/submit-button";
import ImageUploadField from "@/components/image-upload-field";
import LocationFields from "@/components/location-fields";
import { updateVetProfile } from "@/app/vet/actions";

const field = "w-full rounded-md border border-mist-deep px-3 py-2 text-sm";
const label = "mb-1 block text-sm font-medium";
const legend = "mb-3 font-display text-lg font-semibold text-navy-900";
const help = "mt-1 text-xs text-ink-soft";

export type EditableVetProfile = {
  name: string | null;
  /** Shown in the portrait until the vet uploads one of their own. */
  accountPhotoUrl: string | null;
  avatarUrl: string | null;
  clinicImageUrl: string | null;
  licenceNumber: string;
  qualifications: string | null;
  yearsExperience: number | null;
  consultationFee: number | null;
  bio: string | null;
  specialties: string[];
  specialisationIds: string[];
  clinicName: string | null;
  clinicAddress: string | null;
  city: string | null;
  state: string | null;
  postalCode: string | null;
  latitude: number | null;
  longitude: number | null;
  acceptingNewPatients: boolean;
};

/**
 * Everything an owner reads about a vet before booking, in the order
 * they read it: who the vet is, then where the clinic is, then whether
 * there is room for them.
 */
export default function VetProfileForm({
  profile,
  specialisations,
}: {
  profile: EditableVetProfile;
  specialisations: { id: string; name: string }[];
}) {
  return (
    <ActionForm
      action={updateVetProfile}
      resetOnSuccess={false}
      successMessage="Profile saved."
      className="grid gap-10"
    >
      <fieldset>
        <legend className={legend}>Practitioner</legend>

        <div className="grid gap-5">
          <ImageUploadField
            name="avatarUrl"
            label="Your photo"
            request={{ kind: "image", purpose: "vet-avatar" }}
            defaultValue={profile.avatarUrl}
            fallbackUrl={profile.accountPhotoUrl}
            alt="Your photo"
          />

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className={label} htmlFor="name">Display name</label>
              <input
                id="name"
                name="name"
                className={field}
                defaultValue={profile.name ?? ""}
                maxLength={80}
                placeholder="Dr Asha Rao"
                required
              />
              <p className={help}>
                This is your account name, so it also appears on your own pets&apos; records.
              </p>
            </div>

            <div>
              <label className={label} htmlFor="qualifications">Qualifications</label>
              <input
                id="qualifications"
                name="qualifications"
                className={field}
                defaultValue={profile.qualifications ?? ""}
                maxLength={200}
                placeholder="BVSc & AH, MVSc (Surgery)"
              />
            </div>

            <div>
              <label className={label} htmlFor="licenceNumber">Licence number</label>
              <input
                id="licenceNumber"
                name="licenceNumber"
                className={field}
                defaultValue={profile.licenceNumber}
                maxLength={60}
                required
              />
              <p className={help}>Kept on file. Not shown to owners.</p>
            </div>

            <div>
              <label className={label} htmlFor="yearsExperience">Years of experience</label>
              <input
                id="yearsExperience"
                name="yearsExperience"
                type="number"
                min={0}
                max={70}
                step={1}
                className={field}
                defaultValue={profile.yearsExperience ?? ""}
              />
            </div>

            <div>
              <label className={label} htmlFor="consultationFee">Consultation fee (₹)</label>
              <input
                id="consultationFee"
                name="consultationFee"
                type="number"
                min={0}
                max={100000}
                step={1}
                inputMode="numeric"
                className={field}
                defaultValue={profile.consultationFee ?? ""}
                placeholder="500"
              />
              <p className={help}>Per consultation, in whole rupees. Leave empty to not show one.</p>
            </div>

            <div className="sm:col-span-2">
              <label className={label} htmlFor="bio">Bio</label>
              <textarea
                id="bio"
                name="bio"
                rows={5}
                className={field}
                defaultValue={profile.bio ?? ""}
                maxLength={2000}
                placeholder="Where you trained, what you like treating, how you work with anxious animals."
              />
            </div>
          </div>
        </div>
      </fieldset>

      <fieldset>
        <legend className={legend}>Specialties</legend>

        <div className="grid gap-5">
          <div>
            <p className={label} id="specialisations-label">Areas of practice</p>
            <div
              role="group"
              aria-labelledby="specialisations-label"
              className="grid grid-cols-1 gap-2 sm:grid-cols-2"
            >
              {specialisations.map((s) => (
                <label key={s.id} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    name="specialisationIds"
                    value={s.id}
                    defaultChecked={profile.specialisationIds.includes(s.id)}
                  />
                  {s.name}
                </label>
              ))}
            </div>
            <p className={help}>Owners filter the vet list by these.</p>
          </div>

          <div>
            <label className={label} htmlFor="specialties">Other specialties</label>
            <input
              id="specialties"
              name="specialties"
              className={field}
              defaultValue={profile.specialties.join(", ")}
              placeholder="Dogs, Cats, Surgery"
            />
            <p className={help}>
              Anything the list does not cover — animals you treat, procedures you do.
              Separate with commas. Shown as tags on your profile.
            </p>
          </div>
        </div>
      </fieldset>

      <fieldset>
        <legend className={legend}>Clinic or hospital</legend>

        <div className="grid gap-5">
          <ImageUploadField
            name="clinicImageUrl"
            label="Clinic photo"
            variant="banner"
            request={{ kind: "image", purpose: "clinic-photo" }}
            defaultValue={profile.clinicImageUrl}
            alt="Your clinic"
          />

          <div>
            <label className={label} htmlFor="clinicName">Clinic or hospital name</label>
            <input
              id="clinicName"
              name="clinicName"
              className={field}
              defaultValue={profile.clinicName ?? ""}
              maxLength={120}
            />
          </div>

          <div>
            <label className={label} htmlFor="clinicAddress">Street address</label>
            <input
              id="clinicAddress"
              name="clinicAddress"
              className={field}
              defaultValue={profile.clinicAddress ?? ""}
              maxLength={300}
              autoComplete="street-address"
              placeholder="14, 2nd Main Road, Indiranagar"
            />
          </div>

          <LocationFields
            defaults={profile}
            precision="exact"
            manualCoordinates
            buttonLabel="Set clinic GPS coordinates"
            hint="Owners are shown how far the clinic is from them. Use the button while you are at the clinic, or copy the latitude and longitude from a map. The button also fills in the city from OpenStreetMap."
          />
        </div>
      </fieldset>

      <fieldset>
        <legend className={legend}>Bookings</legend>
        <label className="flex items-start gap-3 text-sm">
          <input
            type="checkbox"
            name="acceptingNewPatients"
            defaultChecked={profile.acceptingNewPatients}
            className="mt-0.5"
          />
          <span>
            <span className="font-medium">Accepting new patients</span>
            <span className="block text-xs text-ink-soft">
              When off, you are hidden from the vet list and nobody can book a new
              appointment. Appointments already booked are not affected.
            </span>
          </span>
        </label>
      </fieldset>

      <div>
        <SubmitButton pendingLabel="Saving...">Save profile</SubmitButton>
      </div>
    </ActionForm>
  );
}
