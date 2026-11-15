import Icon, { type IconName } from "@/components/icon";

/**
 * A status, said three ways at once: an icon, a word, and a colour.
 *
 * The colour is the least of the three. About one man in twelve cannot
 * tell the red of "overdue" from the green of "up to date", and nobody
 * can on a greyscale printout of a pet's passport — so the icon's shape
 * and the label carry the meaning and the colour only reinforces it
 * (WCAG 1.4.1). Every tone's text is at least 4.5:1 against its own
 * background (1.4.3).
 */
const TONES = {
  danger: { className: "bg-red-50 text-red-900 ring-red-200", icon: "alert" },
  warning: { className: "bg-amber-50 text-amber-900 ring-amber-200", icon: "clock" },
  ok: { className: "bg-aqua-100 text-navy-900 ring-aqua-400/40", icon: "checkCircle" },
  info: { className: "bg-aqua-50 text-navy-900 ring-aqua-100", icon: "info" },
  neutral: { className: "bg-mist text-ink ring-mist-deep", icon: "dash" },
  solid: { className: "bg-navy-900 text-white ring-navy-900", icon: "lock" },
} as const satisfies Record<string, { className: string; icon: IconName }>;

export type StatusTone = keyof typeof TONES;

export default function StatusPill({
  tone,
  icon,
  children,
  className = "",
}: {
  tone: StatusTone;
  /** Overrides the tone's usual icon when another says it better. */
  icon?: IconName;
  children: React.ReactNode;
  className?: string;
}) {
  const style = TONES[tone];
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ring-1 ${style.className} ${className}`}
    >
      <Icon name={icon ?? style.icon} />
      {children}
    </span>
  );
}

/** Vaccination standing, as shown on the pet page, the passport and the vet's panel. */
export const VACCINE_PILL: Record<string, { label: string; tone: StatusTone; icon?: IconName }> = {
  NEVER_GIVEN: { label: "No record", tone: "neutral" },
  OVERDUE: { label: "Overdue", tone: "danger" },
  DUE_SOON: { label: "Due soon", tone: "warning" },
  UP_TO_DATE: { label: "Up to date", tone: "ok" },
};

/** Allergy severity. UNKNOWN has no entry: nothing is shown for it. */
export const SEVERITY_PILL: Record<string, { label: string; tone: StatusTone; icon?: IconName }> = {
  SEVERE: { label: "Severe", tone: "danger" },
  MODERATE: { label: "Moderate", tone: "warning", icon: "alert" },
  MILD: { label: "Mild", tone: "neutral", icon: "info" },
};
