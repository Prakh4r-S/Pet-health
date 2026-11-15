"use client";

import { useState } from "react";
import { createPet } from "@/app/pets/actions";
import ActionForm from "@/components/action-form";
import SubmitButton from "@/components/submit-button";
import ImageUploadField from "@/components/image-upload-field";


type Breed = { id: string; name: string };
type Species = { id: string; name: string; breeds: Breed[] };

const field = "w-full rounded-md border border-mist-deep px-3 py-2 text-sm";
const label = "block text-sm font-medium mb-1";

export default function PetForm({ species }: { species: Species[] }) {
  const [speciesId, setSpeciesId] = useState(species[0]?.id ?? "");
  const breeds = species.find((s) => s.id === speciesId)?.breeds ?? [];

  return (
    <ActionForm action={createPet} className="grid gap-5">
      <ImageUploadField
        name="photoUrl"
        label="Photo (optional)"
        request={{ kind: "image", purpose: "pet-photo" }}
      />

      <div>
        <label className={label} htmlFor="name">Name</label>
        <input id="name" name="name" className={field} required autoFocus />
      </div>

      <div>
        <label className={label} htmlFor="speciesId">Species</label>
        <select
          id="speciesId"
          name="speciesId"
          className={field}
          value={speciesId}
          onChange={(e) => setSpeciesId(e.target.value)}
          required
        >
          {species.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
      </div>

      <div>
        <label className={label} htmlFor="breedId">Breed</label>
        {/* Keyed on speciesId so React remounts the select when the
            species changes — otherwise a stale breed from the previous
            species stays selected and gets submitted. */}
        <select key={speciesId} id="breedId" name="breedId" className={field} defaultValue="">
          <option value="">Unknown or mixed</option>
          {breeds.map((b) => (
            <option key={b.id} value={b.id}>{b.name}</option>
          ))}
        </select>
        <label className={`${label} mt-3`} htmlFor="breedFreeText">
          Or describe the mix
        </label>
        <input
          id="breedFreeText"
          name="breedFreeText"
          className={field}
          placeholder="e.g. Labrador x Indie"
        />
      </div>

      <div>
        <label className={label} htmlFor="sex">Sex</label>
        <select id="sex" name="sex" className={field} defaultValue="UNKNOWN">
          <option value="UNKNOWN">Unknown</option>
          <option value="MALE">Male</option>
          <option value="FEMALE">Female</option>
        </select>
      </div>

      <div>
        <label className={label} htmlFor="birthDate">Date of birth</label>
        <input id="birthDate" name="birthDate" type="date" className={field} />
        <label className="mt-2 flex items-center gap-2 text-sm text-ink-soft">
          <input type="checkbox" name="birthDateIsApprox" />
          This date is an estimate
        </label>
      </div>

      <SubmitButton pendingLabel="Adding...">Add pet</SubmitButton>
    </ActionForm>
  );
}
