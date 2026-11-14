import Image from "next/image";
import { isUploadedImageUrl } from "@/lib/upload-rules";

const SIZES = {
  md: { box: "h-12 w-12 text-lg", px: 48 },
  lg: { box: "h-24 w-24 text-3xl", px: 96 },
} as const;

/**
 * A person's photo in a circle, or their initial when there is none.
 *
 * `photoUrl` takes the first that is set of several candidates — a vet's
 * portrait, then their account photo, then the picture their sign-in
 * provider supplied — so callers pass them in order of preference.
 */
export default function PersonAvatar({
  name,
  photoUrls,
  size = "md",
  className = "",
}: {
  name: string;
  photoUrls: (string | null | undefined)[];
  size?: keyof typeof SIZES;
  className?: string;
}) {
  const { box, px } = SIZES[size];
  const photoUrl = photoUrls.find(Boolean);
  const frame = `relative shrink-0 overflow-hidden rounded-full border border-mist bg-white ${box} ${className}`;

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

  // Decorative: the name is always printed beside it.
  return (
    <div
      aria-hidden="true"
      className={`${frame} flex items-center justify-center bg-aqua-50 font-display font-semibold text-aqua-600`}
    >
      {name.trim().charAt(0).toUpperCase() || "?"}
    </div>
  );
}
