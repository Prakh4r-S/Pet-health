import { prisma } from "@/lib/prisma";
import { getVaccineStandings } from "@/lib/vaccine-status";

/**
 * Assembles everything the assistant is allowed to know, for one owner.
 *
 * This function is the access control. The model has no database
 * connection and no tools — it can only answer from the text this
 * returns, so scoping the query correctly here is what stops one owner's
 * question surfacing another owner's records. There is no second line of
 * defence and there does not need to be, provided this query is right.
 *
 * The output is plain prose rather than JSON. Models read prose more
 * reliably than nested structures, and the transcript of a consultation
 * is prose anyway.
 */
export async function buildOwnerContext(userId: string): Promise<string> {
  const pets = await prisma.pet.findMany({
    where: { ownerId: userId, archivedAt: null },
    include: {
      species: { select: { name: true } },
      breed: { select: { name: true } },
      weights: { orderBy: { measuredAt: "desc" }, take: 5 },
      allergies: { where: { active: true } },
      conditions: { orderBy: { diagnosedOn: "desc" } },
      appointments: {
        orderBy: { startsAt: "desc" },
        take: 5,
        include: {
          vetProfile: { include: { user: { select: { name: true } } } },
          note: {
            include: { prescriptions: true },
          },
        },
      },
    },
  });

  if (pets.length === 0) {
    return "This owner has no pets on record yet.";
  }

  const today = new Date().toISOString().slice(0, 10);
  const sections: string[] = [`Today's date is ${today}.`];

  for (const pet of pets) {
    const lines: string[] = [];

    const age = pet.birthDate
      ? `${Math.floor(
          (Date.now() - pet.birthDate.getTime()) / (365.25 * 24 * 3600 * 1000),
        )} years old${pet.birthDateIsApprox ? " (approximate)" : ""}`
      : "age unknown";

    lines.push(
      `## ${pet.name} — ${pet.species.name}, ${
        pet.breed?.name ?? pet.breedFreeText ?? "breed unknown"
      }, ${age}${pet.neutered === true ? ", neutered" : ""}`,
    );

    if (pet.weights.length > 0) {
      const readings = [...pet.weights]
        .reverse()
        .map((w) => `${Number(w.weightKg)} kg on ${w.measuredAt.toISOString().slice(0, 10)}`)
        .join(", ");
      lines.push(`Weight readings, oldest first: ${readings}.`);
    } else {
      lines.push("No weight has been recorded.");
    }

    if (pet.allergies.length > 0) {
      lines.push(
        `Known allergies: ${pet.allergies
          .map((a) => `${a.allergen}${a.reaction ? ` (${a.reaction})` : ""}`)
          .join(", ")}.`,
      );
    } else {
      lines.push("No allergies recorded.");
    }

    if (pet.conditions.length > 0) {
      lines.push(
        `Conditions: ${pet.conditions
          .map((c) => `${c.name} (${c.resolvedOn ? "resolved" : "ongoing"})`)
          .join(", ")}.`,
      );
    }

    const standings = await getVaccineStandings(pet.id);
    const vaccineLines = standings.map((s) => {
      if (s.status === "NEVER_GIVEN") return `${s.name}: no record`;
      return `${s.name}: last given ${s.lastGivenOn?.toISOString().slice(0, 10)}${
        s.nextDueOn ? `, next due ${s.nextDueOn.toISOString().slice(0, 10)}` : ""
      } (${s.status.toLowerCase().replace("_", " ")})`;
    });
    lines.push(`Vaccinations:\n- ${vaccineLines.join("\n- ")}`);

    if (pet.appointments.length > 0) {
      lines.push("Recent consultations, most recent first:");
      for (const appointment of pet.appointments) {
        const when = appointment.startsAt.toISOString().slice(0, 10);
        const vet = appointment.vetProfile.user.name ?? "a vet";
        const parts = [`- ${when} with ${vet} (${appointment.status.toLowerCase()})`];

        if (appointment.reason) parts.push(`  Reason given when booking: ${appointment.reason}`);

        // Only finalised notes are included. A draft is the vet's work in
        // progress and may contain machine-proposed text they have not
        // yet checked — quoting that back to an owner as though it were
        // clinical fact would be misrepresenting it.
        const note = appointment.note;
        if (note?.status === "FINALISED") {
          if (note.presentingComplaint) parts.push(`  Presenting complaint: ${note.presentingComplaint}`);
          if (note.examination) parts.push(`  Examination: ${note.examination}`);
          if (note.assessment) parts.push(`  Assessment: ${note.assessment}`);
          if (note.plan) parts.push(`  Plan: ${note.plan}`);
          if (note.followUpOn) {
            parts.push(`  Follow-up date: ${note.followUpOn.toISOString().slice(0, 10)}`);
          }
          for (const p of note.prescriptions) {
            parts.push(
              `  Prescribed: ${p.drug} ${p.dose} ${p.frequency}` +
                `${p.durationDays ? ` for ${p.durationDays} days` : ""}` +
                `${p.instructions ? ` (${p.instructions})` : ""}`,
            );
          }
        } else if (note) {
          parts.push("  The vet has not yet finalised their notes for this consultation.");
        }

        lines.push(parts.join("\n"));
      }
    } else {
      lines.push("No consultations recorded.");
    }

    sections.push(lines.join("\n"));
  }

  return sections.join("\n\n");
}