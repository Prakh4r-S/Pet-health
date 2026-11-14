import ActionForm from "@/components/action-form";
import SubmitButton from "@/components/submit-button";
import ImageUploadField from "@/components/image-upload-field";
import LocationFields from "@/components/location-fields";
import { updateProfile } from "@/app/profile/actions";

const field = "w-full rounded-md border border-mist-deep px-3 py-2 text-sm";
const label = "mb-1 block text-sm font-medium";

export type EditableProfile = {
  name: string | null;
  /** The picture from the sign-in provider, shown until one is uploaded. */
  providerImage: string | null;
  avatarUrl: string | null;
  age: number | null;
  phone: string | null;
  bio: string | null;
  city: string | null;
  state: string | null;
  postalCode: string | null;
  latitude: number | null;
  longitude: number | null;
};

/**
 * The owner's own details. Nothing here is required: an account works
 * without any of it, and each field only improves something specific —
 * a location, most of all, is what lets vets be suggested by distance.
 */
export default function ProfileForm({ profile }: { profile: EditableProfile }) {
  return (
    <ActionForm
      action={updateProfile}
      resetOnSuccess={false}
      successMessage="Profile saved."
      className="grid gap-8"
    >
      <ImageUploadField
        name="avatarUrl"
        label="Profile picture"
        request={{ kind: "image", purpose: "user-avatar" }}
        defaultValue={profile.avatarUrl}
        fallbackUrl={profile.providerImage}
        alt="Your profile picture"
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
            autoComplete="name"
          />
        </div>

        <div>
          <label className={label} htmlFor="age">Age</label>
          <input
            id="age"
            name="age"
            type="number"
            min={1}
            max={120}
            step={1}
            inputMode="numeric"
            className={field}
            defaultValue={profile.age ?? ""}
          />
        </div>

        <div>
          <label className={label} htmlFor="phone">Phone number</label>
          <input
            id="phone"
            name="phone"
            type="tel"
            className={field}
            defaultValue={profile.phone ?? ""}
            maxLength={20}
            autoComplete="tel"
            placeholder="+91 98765 43210"
          />
        </div>

        <div className="sm:col-span-2">
          <label className={label} htmlFor="bio">Short bio</label>
          <textarea
            id="bio"
            name="bio"
            rows={3}
            className={field}
            defaultValue={profile.bio ?? ""}
            maxLength={500}
            placeholder="A line or two about you and your animals."
          />
        </div>
      </div>

      <fieldset>
        <legend className="mb-3 font-display text-lg font-semibold text-navy-900">
          Location
        </legend>
        <LocationFields
          defaults={profile}
          hint="Used to suggest vets near you. Your position is rounded to about 100 m, and looked up with OpenStreetMap to fill in the city. Save to keep it."
        />
      </fieldset>

      <div>
        <SubmitButton pendingLabel="Saving...">Save profile</SubmitButton>
      </div>
    </ActionForm>
  );
}
