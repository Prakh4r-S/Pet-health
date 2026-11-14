import Link from "next/link";
import { getOptionalUser } from "@/lib/current-user";

export const dynamic = "force-dynamic";

const primary =
  "rounded-md bg-pine-900 px-5 py-3 text-sm font-medium text-white hover:bg-pine-700";
const secondary =
  "rounded-md border border-mist px-5 py-3 text-sm font-medium text-pine-900 hover:bg-pine-50";

const steps = [
  {
    title: "Add your pets",
    body: "Species, breed, weight, vaccinations and any documents you already have. It takes a few minutes per animal.",
  },
  {
    title: "Book a vet",
    body: "Pick a time that suits you from a vet's own calendar, or ask to be matched with whoever is free soonest.",
  },
  {
    title: "Meet over video",
    body: "The vet sees your pet's history during the call and writes up a record afterwards. It stays with your pet's file.",
  },
];

const pillars = [
  {
    title: "Medical records and documents",
    body: "Weight history, allergies, conditions and vaccinations for every pet, with lab reports, prescriptions and scans stored privately alongside them.",
    points: [
      "Tells you what's overdue and what was never given",
      "Weight charted against the breed's typical range",
      "Files are private — only you and a vet treating your pet can open them",
    ],
  },
  {
    title: "Tele-vet consultations",
    body: "Video appointments with a vet who has your pet's records in front of them, so you don't spend the first ten minutes reciting history.",
    points: [
      "Times shown in your own timezone",
      "A written record and structured prescriptions after each call",
      "Vets see a pet's file only once you book with them",
    ],
  },
  {
    title: "AI health assistant",
    body: "Ask plain questions about your own pets' records — when a vaccination is due, what was prescribed, how weight has changed.",
    points: [
      "Answers only from your records, not from guesswork",
      "Won't diagnose or advise on treatment",
      "Points you to a vet when the question needs one",
    ],
  },
];

/**
 * A static picture of what a pet's page looks like once it has some
 * history. Built from markup rather than a screenshot so it stays sharp
 * and in the theme; the animal and its details are invented.
 */
function RecordPreview() {
  return (
    <figure className="rounded-2xl border border-mist bg-white p-5 shadow-[0_20px_60px_-30px_rgba(20,61,51,0.35)] sm:p-6">
      <figcaption className="sr-only">
        Example of a pet&apos;s health record with an upcoming consultation
      </figcaption>

      <div aria-hidden="true">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="font-display text-2xl text-pine-900">Biscuit</p>
            <p className="mt-0.5 text-sm text-bark-soft">Beagle · 4 yr 2 mo · 10.4 kg</p>
          </div>
          <span className="rounded-full bg-pine-50 px-2.5 py-1 text-xs text-pine-700">
            Example
          </span>
        </div>

        <div className="mt-5 rounded-lg bg-pine-50 p-4">
          <div className="flex items-baseline justify-between">
            <p className="text-xs font-medium uppercase tracking-wide text-pine-700">Weight</p>
            <p className="text-xs text-bark-soft">Typical range 9–11 kg</p>
          </div>
          <svg viewBox="0 0 280 64" className="mt-2 h-16 w-full" preserveAspectRatio="none">
            <rect x="0" y="14" width="280" height="30" fill="#2c6b58" fillOpacity="0.1" />
            <polyline
              points="4,46 50,42 96,40 142,34 188,36 234,30 276,28"
              fill="none"
              stroke="#143d33"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
            />
          </svg>
        </div>

        <ul className="mt-4 divide-y divide-mist text-sm">
          <li className="flex items-center justify-between py-2.5">
            <span>
              Rabies <span className="text-xs text-bark-soft">· core</span>
            </span>
            <span className="rounded-full bg-pine-100 px-2.5 py-0.5 text-xs text-pine-900">
              Up to date
            </span>
          </li>
          <li className="flex items-center justify-between py-2.5">
            <span>
              DHPP <span className="text-xs text-bark-soft">· core</span>
            </span>
            <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs text-amber-800">
              Due in 12 days
            </span>
          </li>
          <li className="flex items-center justify-between py-2.5">
            <span>Blood panel</span>
            <span className="text-xs text-bark-soft">Lab report · PDF</span>
          </li>
        </ul>

        <div className="mt-4 flex items-center justify-between gap-4 rounded-lg border border-pine-100 p-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-pine-700">
              Upcoming consultation
            </p>
            <p className="mt-1 text-sm">Thu 14:30 · Dr Mehta</p>
            <p className="text-xs text-bark-soft">Follow-up on ear infection</p>
          </div>
          <span className="shrink-0 rounded-md bg-pine-900 px-3 py-1.5 text-sm text-white">
            Join call
          </span>
        </div>
      </div>
    </figure>
  );
}

/**
 * The public front page.
 *
 * Open to everyone, signed in or not — it is the one page that explains
 * what this is before asking for an account. Someone already signed in
 * sees the same page with the calls to action pointing at their own
 * dashboard; /welcome decides whether that means their pets or, for a
 * vet, their schedule.
 */
export default async function LandingPage() {
  const user = await getOptionalUser();

  return (
    <main>
      <section className="mx-auto grid max-w-5xl items-center gap-12 px-6 py-16 lg:grid-cols-[1.05fr_1fr] lg:py-24">
        <div>
          <p className="text-sm font-medium uppercase tracking-wide text-pine-500">
            Pet records and online vet care
          </p>
          <h1 className="mt-4 text-4xl leading-tight text-pine-900 sm:text-5xl">
            Your pet&apos;s whole medical history, and a vet who can{" "}
            <em className="italic">actually see it</em>.
          </h1>
          <p className="mt-5 max-w-xl text-lg leading-8 text-bark-soft">
            Keep every pet&apos;s records in one place, know which vaccinations are
            due before they lapse, and see a vet over video without leaving home.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            {user ? (
              <Link href="/welcome" className={primary}>
                Go to dashboard
              </Link>
            ) : (
              <Link href="/signin" className={primary}>
                Get started
              </Link>
            )}
            <Link href="#how-it-works" className={secondary}>
              How it works
            </Link>
          </div>

          {!user && (
            <p className="mt-4 text-sm text-bark-soft">
              Sign in with Google. No separate password to remember.
            </p>
          )}
        </div>

        <RecordPreview />
      </section>

      <section id="how-it-works" className="scroll-mt-8 border-y border-mist bg-pine-50">
        <div className="mx-auto max-w-5xl px-6 py-16">
          <h2 className="text-3xl text-pine-900">How it works</h2>
          <ol className="mt-10 grid gap-8 md:grid-cols-3">
            {steps.map((step, i) => (
              <li key={step.title}>
                <p className="font-display text-4xl text-pine-500">{i + 1}</p>
                <h3 className="mt-3 text-xl text-pine-900">{step.title}</h3>
                <p className="mt-2 leading-7 text-bark-soft">{step.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-6 py-16">
        <h2 className="max-w-2xl text-3xl text-pine-900">
          Three things, built to work together
        </h2>
        <div className="mt-10 grid gap-6 md:grid-cols-3">
          {pillars.map((pillar) => (
            <article key={pillar.title} className="rounded-xl border border-mist p-6">
              <h3 className="text-xl text-pine-900">{pillar.title}</h3>
              <p className="mt-3 leading-7 text-bark-soft">{pillar.body}</p>
              <ul className="mt-5 space-y-2 text-sm">
                {pillar.points.map((point) => (
                  <li key={point} className="flex gap-2.5">
                    <span
                      aria-hidden="true"
                      className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-pine-500"
                    />
                    <span>{point}</span>
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </section>

      <section id="for-vets" className="scroll-mt-8 bg-pine-900">
        <div className="mx-auto grid max-w-5xl items-center gap-8 px-6 py-16 md:grid-cols-[1.4fr_1fr]">
          <div>
            <h2 className="text-3xl text-white">Are you a veterinarian?</h2>
            <p className="mt-4 max-w-xl leading-7 text-pine-100">
              Set your own consulting hours and see patients over video with their
              records beside the call. Capture annotated snapshots, write a
              structured note that locks once you finalise it, and review a
              draft transcribed from the consultation — nothing reaches the
              record until you accept it.
            </p>
          </div>
          <div className="md:text-right">
            <Link
              href="/signin?as=vet"
              className="inline-block rounded-md bg-white px-5 py-3 text-sm font-medium text-pine-900 hover:bg-pine-50"
            >
              Set up a practitioner account
            </Link>
            <p className="mt-3 text-sm text-pine-100">
              You&apos;ll need your licence number.
            </p>
          </div>
        </div>
      </section>

      <footer className="mx-auto max-w-5xl px-6 py-8 text-sm text-bark-soft">
        Pet Health is a demonstration project. It is not a substitute for
        emergency veterinary care.
      </footer>
    </main>
  );
}
