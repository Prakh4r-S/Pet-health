import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/current-user";
import { getAvailableSlots } from "@/lib/slots";
import { distanceKm, formatDistance, toCoordinates } from "@/lib/geo";
import { isUploadedImageUrl } from "@/lib/upload-rules";
import SlotPicker from "@/components/slot-picker";
import PersonAvatar from "@/components/person-avatar";

const rupees = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

/** The curated areas first, then the vet's own tags, without repeats. */
function mergeTags(curated: string[], own: string[]) {
  const seen = new Set<string>();
  return [...curated, ...own].filter((tag) => {
    const key = tag.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-ink-soft">{label}</dt>
      <dd className="mt-0.5 text-sm font-medium text-navy-900">{children}</dd>
    </div>
  );
}

export default async function VetDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await getCurrentUser();

  // Selected field by field: this page is shown to any signed-in owner,
  // and the licence number, for one, is not theirs to read.
  const vet = await prisma.vetProfile.findFirst({
    where: { id, verifiedAt: { not: null } },
    select: {
      id: true,
      avatarUrl: true,
      qualifications: true,
      bio: true,
      specialties: true,
      yearsExperience: true,
      consultationFee: true,
      clinicName: true,
      clinicImageUrl: true,
      clinicAddress: true,
      city: true,
      state: true,
      postalCode: true,
      latitude: true,
      longitude: true,
      slotMinutes: true,
      acceptingNewPatients: true,
      user: { select: { name: true, avatarUrl: true, image: true } },
      specialisations: { orderBy: { name: "asc" }, select: { name: true } },
    },
  });
  if (!vet) notFound();

  const [pets, slots, viewer] = await Promise.all([
    prisma.pet.findMany({
      where: { ownerId: user.id, archivedAt: null },
      select: { id: true, name: true, species: { select: { name: true } } },
      orderBy: { name: "asc" },
    }),
    getAvailableSlots(vet.id),
    prisma.user.findUnique({
      where: { id: user.id },
      select: { latitude: true, longitude: true },
    }),
  ]);

  const name = vet.user.name ?? "Vet";
  const tags = mergeTags(
    vet.specialisations.map((s) => s.name),
    vet.specialties,
  );

  const clinicAt = toCoordinates(vet);
  const viewerAt = viewer ? toCoordinates(viewer) : null;
  const distance = clinicAt && viewerAt ? distanceKm(viewerAt, clinicAt) : null;

  const locality = [vet.city, vet.state].filter(Boolean).join(", ");
  const addressLines = [
    vet.clinicAddress,
    [locality, vet.postalCode].filter(Boolean).join(" "),
  ].filter(Boolean);

  const mapUrl = clinicAt
    ? `https://www.openstreetmap.org/?mlat=${clinicAt.latitude}&mlon=${clinicAt.longitude}#map=16/${clinicAt.latitude}/${clinicAt.longitude}`
    : null;

  return (
    <main className="mx-auto max-w-2xl px-6 py-10">
      <Link href="/vets" className="text-sm text-ink-soft hover:underline">
        Back to vets
      </Link>

      <header className="mt-3">
        {vet.clinicImageUrl && (
          <div className="relative aspect-[3/1] overflow-hidden rounded-lg border border-mist bg-mist">
            <Image
              src={vet.clinicImageUrl}
              alt={vet.clinicName ? `${vet.clinicName}` : `${name}'s clinic`}
              fill
              priority
              sizes="(min-width: 672px) 624px, 100vw"
              unoptimized={!isUploadedImageUrl(vet.clinicImageUrl)}
              className="object-cover"
            />
          </div>
        )}

        {/* With a banner, the portrait overlaps its lower edge. */}
        <div className={`flex items-end gap-4 ${vet.clinicImageUrl ? "-mt-10 px-4" : ""}`}>
          <PersonAvatar
            name={name}
            photoUrls={[vet.avatarUrl, vet.user.avatarUrl, vet.user.image]}
            size="lg"
            className={vet.clinicImageUrl ? "ring-4 ring-cream" : ""}
          />
          <div className="min-w-0 pb-1">
            <h1 className="text-2xl text-navy-900">{name}</h1>
            {vet.qualifications && (
              <p className="text-sm text-ink-soft">{vet.qualifications}</p>
            )}
          </div>
        </div>

        {tags.length > 0 && (
          <ul aria-label="Specialties" className="mt-5 flex flex-wrap gap-2">
            {tags.map((tag) => (
              <li key={tag} className="rounded-full bg-aqua-50 px-3 py-1 text-xs text-navy-900">
                {tag}
              </li>
            ))}
          </ul>
        )}
      </header>

      <dl className="mt-6 grid grid-cols-2 gap-4 rounded-lg border border-mist p-5 sm:grid-cols-4">
        <Fact label="Experience">
          {vet.yearsExperience != null
            ? `${vet.yearsExperience} ${vet.yearsExperience === 1 ? "year" : "years"}`
            : "Not stated"}
        </Fact>
        <Fact label="Consultation fee">
          {vet.consultationFee != null ? rupees.format(vet.consultationFee) : "Not stated"}
        </Fact>
        <Fact label="Appointment length">{vet.slotMinutes} minutes</Fact>
        <Fact label="Distance from you">
          {distance != null ? (
            formatDistance(distance)
          ) : clinicAt ? (
            <Link href="/profile" className="font-normal text-navy-700 underline">
              Set your location
            </Link>
          ) : (
            "Not available"
          )}
        </Fact>
      </dl>

      {vet.bio && (
        <section className="mt-8">
          <h2 className="text-lg text-navy-900">About</h2>
          <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-ink">{vet.bio}</p>
        </section>
      )}

      <section className="mt-8">
        <h2 className="text-lg text-navy-900">Clinic</h2>
        <p className="mt-2 text-sm font-medium">{vet.clinicName ?? "Independent practice"}</p>
        {addressLines.length > 0 ? (
          <address className="mt-1 text-sm not-italic leading-6 text-ink-soft">
            {addressLines.map((line) => (
              <span key={line} className="block">
                {line}
              </span>
            ))}
          </address>
        ) : (
          <p className="mt-1 text-sm text-ink-soft">No address given.</p>
        )}
        {mapUrl && (
          <a
            href={mapUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 inline-block text-sm text-navy-700 underline"
          >
            Open in a map
          </a>
        )}
      </section>

      <section className="mt-8 rounded-lg border border-mist p-5">
        <h2 className="mb-4 font-medium">Book an appointment</h2>
        {vet.acceptingNewPatients ? (
          <SlotPicker
            vetProfileId={vet.id}
            pets={pets.map((p) => ({ id: p.id, name: p.name, species: p.species.name }))}
            slots={slots.map((s) => s.startsAt.toISOString())}
          />
        ) : (
          <p className="rounded-md border border-dashed border-mist-deep p-6 text-center text-sm text-ink-soft">
            {name} is not taking new bookings at the moment.
          </p>
        )}
      </section>
    </main>
  );
}
