/**
 * The owner's pre-visit brief: what is wrong, for how long, and how
 * pressing it feels. Collected at booking, shown to the vet before and
 * after the call.
 *
 * Kept free of server-only imports so the booking form (a client
 * component) and the pages that display the brief share one set of
 * labels.
 */

export const SYMPTOM_DURATIONS = ["TODAY", "FEW_DAYS", "ABOUT_A_WEEK", "OVER_A_WEEK"] as const;
export type SymptomDuration = (typeof SYMPTOM_DURATIONS)[number];

export const DURATION_LABELS: Record<SymptomDuration, string> = {
  TODAY: "Today",
  FEW_DAYS: "2–3 days",
  ABOUT_A_WEEK: "4–7 days",
  OVER_A_WEEK: "1+ week",
};

export const VISIT_URGENCIES = ["ROUTINE", "SOON", "URGENT"] as const;
export type VisitUrgency = (typeof VISIT_URGENCIES)[number];

export const URGENCY_LABELS: Record<VisitUrgency, string> = {
  ROUTINE: "Routine",
  SOON: "Soon",
  URGENT: "Urgent",
};

export const URGENCY_HINTS: Record<VisitUrgency, string> = {
  ROUTINE: "A check-up or a question that can wait",
  SOON: "Worrying, but eating, drinking and alert",
  URGENT: "Getting worse, in pain, or not themselves",
};

export type VisitIntake = {
  concern: string | null;
  duration: SymptomDuration | null;
  urgency: VisitUrgency | null;
  notes: string | null;
};

const MAX_CONCERN = 500;
const MAX_NOTES = 1000;

/**
 * Reads the intake from a booking form.
 *
 * The concern is required: a vet joining a call with no idea why is the
 * thing this exists to prevent. Duration is required too, because the
 * form always offers it and "how long" changes what the vet asks first.
 * Urgency and notes are optional. Enum values come from hidden or select
 * inputs, so anything outside the list is treated as not given rather
 * than trusted.
 */
export function parseIntake(
  formData: FormData,
): { ok: true; intake: VisitIntake } | { ok: false; error: string } {
  const concern = String(formData.get("reason") ?? "").trim();
  const durationRaw = String(formData.get("symptomDuration") ?? "");
  const urgencyRaw = String(formData.get("urgency") ?? "");
  const notes = String(formData.get("intakeNotes") ?? "").trim();

  if (!concern) return { ok: false, error: "Describe the main concern or symptoms." };
  if (concern.length > MAX_CONCERN) {
    return { ok: false, error: `Keep the main concern under ${MAX_CONCERN} characters.` };
  }
  if (notes.length > MAX_NOTES) {
    return { ok: false, error: `Keep the notes under ${MAX_NOTES} characters.` };
  }

  const duration = (SYMPTOM_DURATIONS as readonly string[]).includes(durationRaw)
    ? (durationRaw as SymptomDuration)
    : null;
  if (!duration) return { ok: false, error: "Say how long this has been going on." };

  const urgency = (VISIT_URGENCIES as readonly string[]).includes(urgencyRaw)
    ? (urgencyRaw as VisitUrgency)
    : null;

  return { ok: true, intake: { concern, duration, urgency, notes: notes || null } };
}

/** The columns on Appointment the intake is stored in. */
export function intakeToAppointmentData(intake: VisitIntake) {
  return {
    reason: intake.concern,
    symptomDuration: intake.duration,
    urgency: intake.urgency,
    intakeNotes: intake.notes,
  };
}

export function intakeFromAppointment(a: {
  reason: string | null;
  symptomDuration: SymptomDuration | null;
  urgency: VisitUrgency | null;
  intakeNotes: string | null;
}): VisitIntake {
  return {
    concern: a.reason,
    duration: a.symptomDuration,
    urgency: a.urgency,
    notes: a.intakeNotes,
  };
}

export function hasIntake(intake: VisitIntake) {
  return Boolean(intake.concern || intake.duration || intake.urgency || intake.notes);
}
