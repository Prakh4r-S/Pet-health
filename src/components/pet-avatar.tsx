import Image from "next/image";
import { isUploadedImageUrl } from "@/lib/upload-rules";

/** Species we have a picture for. Anything else falls back to the pet's initial. */
const SPECIES_ICON: Record<string, string> = {
  dog: "🐶",
  cat: "🐱",
  rabbit: "🐰",
  bird: "🐦",
  hamster: "🐹",
  fish: "🐟",
  turtle: "🐢",
  horse: "🐴",
};

const SIZES = {
  sm: { box: "h-7 w-7 text-sm", px: 28 },
  md: { box: "h-12 w-12 text-xl", px: 48 },
  lg: { box: "h-20 w-20 text-4xl", px: 80 },
} as const;

/**
 * A pet's photo in a circle, or a stand-in when there is none.
 *
 * The stand-in is the species' icon where we have one and the pet's
 * initial otherwise, so a list of pets without photos is still a list of
 * different things rather than a column of identical grey discs.
 */
export default function PetAvatar({
  name,
  speciesSlug,
  photoUrl,
  size = "md",
}: {
  name: string;
  speciesSlug: string;
  photoUrl: string | null;
  size?: keyof typeof SIZES;
}) {
  const { box, px } = SIZES[size];
  const frame = `relative shrink-0 overflow-hidden rounded-full border border-mist ${box}`;

  if (photoUrl) {
    return (
      <div className={frame}>
        <Image
          src={photoUrl}
          alt={`Photo of ${name}`}
          fill
          sizes={`${px}px`}
          // Only our own uploads are on a host the optimiser will fetch.
          unoptimized={!isUploadedImageUrl(photoUrl)}
          className="object-cover"
        />
      </div>
    );
  }

  const icon = SPECIES_ICON[speciesSlug];

  // Decorative: wherever this appears, the pet's name is beside it.
  return (
    <div
      aria-hidden="true"
      className={`${frame} flex items-center justify-center bg-aqua-50 font-display font-semibold text-aqua-600`}
    >
      {icon ?? (name.trim().charAt(0).toUpperCase() || "?")}
    </div>
  );
}
