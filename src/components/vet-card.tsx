import Image from "next/image";
import Link from "next/link";
import PersonAvatar from "@/components/person-avatar";
import { isUploadedImageUrl } from "@/lib/upload-rules";
import type { MatchReason, RecommendedVet } from "@/lib/vet-matching";

const rupees = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

/** Each kind of reason keeps one colour, so the pills can be told apart at a glance. */
const REASON_STYLE: Record<MatchReason["kind"], string> = {
  proximity: "bg-aqua-100 text-navy-900",
  pet: "bg-navy-900 text-white",
  availability: "border border-aqua-600 text-aqua-600",
};

function specialtyTags(vet: RecommendedVet) {
  const seen = new Set<string>();
  return [...vet.specialisations.map((s) => s.name), ...vet.specialties].filter((tag) => {
    const key = tag.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * One vet in a list of recommendations.
 *
 * `full` is the directory card: portrait, clinic photo, why they were
 * recommended, what they treat, the fee and the way to book. `compact`
 * is the same vet in a third of the width, for the strip on the pets
 * page — the reasons stay, the detail waits for the profile.
 *
 * The whole card is not a link. It holds a real call to action, and a
 * link wrapped round a card reads its entire contents out as the link's
 * name.
 */
export default function VetCard({
  vet,
  variant = "full",
}: {
  vet: RecommendedVet;
  variant?: "full" | "compact";
}) {
  const name = vet.user.name ?? "Vet";
  const href = `/vets/${vet.id}`;
  const { reasons, distanceLabel } = vet.match;
  const where = [vet.clinicName ?? "Independent", vet.city?.trim()].filter(Boolean).join(" · ");

  const reasonPills = reasons.length > 0 && (
    <ul aria-label="Why this vet is recommended" className="flex flex-wrap gap-1.5">
      {reasons.map((reason) => (
        <li
          key={reason.label}
          className={`rounded-full px-2.5 py-0.5 text-xs ${REASON_STYLE[reason.kind]}`}
        >
          {reason.label}
        </li>
      ))}
    </ul>
  );

  if (variant === "compact") {
    return (
      <article className="flex h-full flex-col rounded-lg border border-mist p-4">
        <div className="flex items-center gap-3">
          <PersonAvatar
            name={name}
            photoUrls={[vet.avatarUrl, vet.user.avatarUrl, vet.user.image]}
          />
          <div className="min-w-0">
            <h3 className="truncate font-sans text-sm font-medium">{name}</h3>
            <p className="truncate text-xs text-ink-soft">{where}</p>
          </div>
        </div>
        {reasonPills && <div className="mt-3">{reasonPills}</div>}
        <Link
          href={href}
          className="mt-auto pt-3 text-sm font-medium text-navy-700 hover:underline"
        >
          View Clinic &amp; Book
          <span className="sr-only"> with {name}</span>
        </Link>
      </article>
    );
  }

  const tags = specialtyTags(vet);

  return (
    <article className="flex gap-4 rounded-lg border border-mist p-5">
      <PersonAvatar
        name={name}
        photoUrls={[vet.avatarUrl, vet.user.avatarUrl, vet.user.image]}
      />

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <h2 className="font-sans text-base font-medium">{name}</h2>
          {distanceLabel && (
            <span className="rounded-full bg-aqua-50 px-2.5 py-0.5 text-xs font-medium text-aqua-600">
              {distanceLabel}
            </span>
          )}
        </div>
        <p className="mt-0.5 text-sm text-ink-soft">
          {where}
          {vet.yearsExperience != null && ` · ${vet.yearsExperience} yrs`}
        </p>

        {reasonPills && <div className="mt-3">{reasonPills}</div>}

        {tags.length > 0 && (
          <p className="mt-3 text-xs text-ink-soft">{tags.join(" · ")}</p>
        )}

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm">
            {vet.consultationFee != null ? (
              <>
                <span className="font-medium text-navy-900">
                  {rupees.format(vet.consultationFee)}
                </span>
                <span className="text-ink-soft"> per consultation</span>
              </>
            ) : (
              <span className="text-ink-soft">Fee not stated</span>
            )}
          </p>
          <Link
            href={href}
            className="rounded-md bg-navy-900 px-4 py-2 text-sm text-white hover:bg-navy-700"
          >
            View Clinic &amp; Book
            <span className="sr-only"> with {name}</span>
          </Link>
        </div>
      </div>

      {vet.clinicImageUrl && (
        <div className="relative hidden h-24 w-36 shrink-0 overflow-hidden rounded-md border border-mist bg-mist sm:block">
          <Image
            src={vet.clinicImageUrl}
            alt={vet.clinicName ?? `${name}'s clinic`}
            fill
            sizes="144px"
            unoptimized={!isUploadedImageUrl(vet.clinicImageUrl)}
            className="object-cover"
          />
        </div>
      )}
    </article>
  );
}
