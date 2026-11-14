import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/current-user";
import { createVetProfile } from "../actions";
import { DEFAULT_TIMEZONE, listTimezones } from "@/lib/timezones";
import ActionForm from "@/components/action-form";
import SubmitButton from "@/components/submit-button";

const field = "w-full rounded-md border border-gray-300 px-3 py-2 text-sm";
const label = "block text-sm font-medium mb-1";

export default async function VetOnboardingPage() {
  const user = await getCurrentUser();

  const existing = await prisma.vetProfile.findUnique({
    where: { userId: user.id },
    select: { id: true },
  });
  if (existing) redirect("/vet/availability");

  const specialisations = await prisma.specialisation.findMany({
    orderBy: { name: "asc" },
  });
  const timezones = listTimezones();

  return (
    <main className="mx-auto max-w-xl px-6 py-10">
      <h1 className="text-2xl font-semibold">Register as a vet</h1>
      <p className="mb-8 mt-2 text-sm text-gray-600">
        This adds a practitioner profile to your account. You can still keep your
        own pets&apos; records.
      </p>

      <ActionForm action={createVetProfile} className="grid gap-5" resetOnSuccess={false}>
        <div>
          <label className={label} htmlFor="licenceNumber">Licence number</label>
          <input id="licenceNumber" name="licenceNumber" className={field} required />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={label} htmlFor="clinicName">Clinic</label>
            <input id="clinicName" name="clinicName" className={field} />
          </div>
          <div>
            <label className={label} htmlFor="city">City</label>
            <input id="city" name="city" className={field} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={label} htmlFor="yearsExperience">Years of experience</label>
            <input
              id="yearsExperience"
              name="yearsExperience"
              type="number"
              min="0"
              max="70"
              className={field}
            />
          </div>
          <div>
            <label className={label} htmlFor="slotMinutes">Appointment length</label>
            <select id="slotMinutes" name="slotMinutes" className={field} defaultValue="30">
              <option value="15">15 minutes</option>
              <option value="20">20 minutes</option>
              <option value="30">30 minutes</option>
              <option value="45">45 minutes</option>
              <option value="60">60 minutes</option>
            </select>
          </div>
        </div>

        <div>
          <label className={label} htmlFor="timezone">Timezone</label>
          <select id="timezone" name="timezone" className={field} defaultValue={DEFAULT_TIMEZONE}>
            {timezones.map((zone) => (
              <option key={zone} value={zone}>
                {zone.replaceAll("_", " ")}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-gray-500">
            Your consulting hours and days off are set in this timezone. Owners
            see appointment times converted to their own.
          </p>
        </div>

        <fieldset>
          <legend className={label}>Specialisations</legend>
          <div className="grid grid-cols-2 gap-2">
            {specialisations.map((s) => (
              <label key={s.id} className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="specialisationIds" value={s.id} />
                {s.name}
              </label>
            ))}
          </div>
        </fieldset>

        <div>
          <label className={label} htmlFor="bio">About you</label>
          <textarea id="bio" name="bio" rows={4} className={field} />
        </div>

        <SubmitButton pendingLabel="Creating profile...">Create profile</SubmitButton>
      </ActionForm>
    </main>
  );
}
