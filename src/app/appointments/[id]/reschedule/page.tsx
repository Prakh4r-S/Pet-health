import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/current-user";
import { getAvailableSlots } from "@/lib/slots";
import { intakeFromAppointment } from "@/lib/visit-intake";
import LocalTime from "@/components/local-time";
import IntakeSummary from "@/components/intake-summary";
import RescheduleForm from "@/components/reschedule-form";

export const metadata: Metadata = { title: "Reschedule · Max Petcare" };

export default async function ReschedulePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await getCurrentUser();

  // Owner only. Anyone else gets the same answer as for an id that
  // does not exist.
  const appointment = await prisma.appointment.findFirst({
    where: { id, ownerId: user.id },
    select: {
      id: true,
      status: true,
      startsAt: true,
      vetProfileId: true,
      reason: true,
      symptomDuration: true,
      urgency: true,
      intakeNotes: true,
      pet: { select: { name: true, species: { select: { name: true } } } },
      vetProfile: { select: { user: { select: { name: true } } } },
    },
  });
  if (!appointment) notFound();

  // Nothing to move once it has started, been cancelled or completed.
  if (appointment.status !== "SCHEDULED" || appointment.startsAt <= new Date()) {
    redirect("/appointments");
  }

  const slots = await getAvailableSlots(appointment.vetProfileId);
  const vetName = appointment.vetProfile.user.name ?? "your vet";

  return (
    <main className="mx-auto max-w-2xl px-6 py-10">
      <Link href="/appointments" className="text-sm text-ink-soft hover:underline">
        Back to appointments
      </Link>

      <h1 className="mt-3 text-2xl text-navy-900">Reschedule</h1>
      <p className="mt-1 text-sm text-ink-soft">
        {appointment.pet.name} with {vetName}, currently{" "}
        <span className="font-medium text-ink">
          <LocalTime date={appointment.startsAt.toISOString()} />
        </span>
        .
      </p>

      <section className="mt-6 rounded-lg border border-mist bg-white p-5">
        <h2 className="mb-1 font-medium">Pick a new time with {vetName}</h2>
        <p className="mb-4 text-xs text-ink-soft">
          Your current time is released as soon as you confirm. The link to the
          call stays the same.
        </p>
        <RescheduleForm
          appointmentId={appointment.id}
          slots={slots.map((s) => s.startsAt.toISOString())}
        />
      </section>

      <div className="mt-6">
        <IntakeSummary
          intake={intakeFromAppointment(appointment)}
          petName={appointment.pet.name}
          species={appointment.pet.species.name}
          heading="Your pre-visit brief — kept as it is"
        />
      </div>
    </main>
  );
}
