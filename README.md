# Pet Health

A veterinary telehealth and pet records application. Owners keep their
animals' health records, book video consultations, and ask questions
about their own data; vets run those consultations, see the patient's
history mid-call, capture annotated snapshots, and write up a clinical
record that a transcription pipeline drafts for them to review.

**Live:** https://pet-health-lime.vercel.app
**Transcription service:** https://github.com/Prakh4r-S/pet-health-transcription

Built as a portfolio project. It is a working proof of concept, not a
product — the limitations section below is not boilerplate and is worth
reading.

---

## What it does

**Records.** Multiple pets across species, with weight history, allergies,
conditions, vaccination status, and uploaded documents. Vaccination status
distinguishes *overdue* from *never recorded*, which matters more than it
sounds: a pet with no vaccinations at all has no rows, so a query over
due-dates reports nothing due while the animal is entirely unprotected.

**Booking.** Vets publish weekly availability in their own timezone; slots
are generated as absolute instants and rendered in the viewer's timezone.
There is also an instant-match path for "see any vet now".

**Consultations.** Video via LiveKit, with the patient's records in a side
panel, annotated snapshots captured from the video stream, and a notepad —
all inside the call, because navigating away would drop the connection.

**Clinical records.** The vet writes a structured note that locks on
finalisation; corrections afterwards are appended as amendments rather
than edits. Prescriptions are structured rather than free text.

**Drafted notes.** Consultation audio is transcribed and turned into a
proposed note. The vet accepts fields individually into their own record.
Nothing generated reaches the clinical record without a human accepting
it.

**Records assistant.** A chat interface answering questions about the
owner's own records, grounded in retrieved data, with clinical questions
redirected to booking a consultation.

---

## Architecture

```
Next.js (Vercel)                    FastAPI (Render)
├── App Router, server actions      ├── faster-whisper  transcription
├── Auth.js + Google OAuth          ├── Gemini          note extraction
├── Prisma → Postgres (Neon)        └── Gemini          records assistant
├── Vercel Blob (private)
└── LiveKit (video)
```

The split is deliberate. Everything ML-shaped lives in one Python service
with no database access and no notion of users; the Next.js application
owns identity, authorisation, and data, and hands the service exactly
what it needs. That keeps the interesting part isolated and testable, and
means the service can be evaluated on its own.

---

## Design decisions

These are the parts worth arguing about.

### Access control is relationship-based, not role-based

An owner sees their pets because they own them. A vet sees a patient
because they have an appointment with *that specific animal* — not
because they hold a vet role, which would grant every vet access to every
record in the system. Access begins when the appointment is booked and
persists afterwards so the vet can review what they treated; a cancelled
appointment confers nothing.

The vet's access is read-only. Seeing a record is not authority to
rewrite it — the vet writes to their own consultation note instead,
attributed and timestamped.

### Double-booking is prevented by the database, not the application

Two owners can load the same vet's slots and both see 14:00 free. Both
pass an application-level "is this available?" check, because neither has
written yet. Only the database can arbitrate.

```sql
CREATE UNIQUE INDEX "appointment_vet_slot_unique"
  ON "Appointment" ("vetProfileId", "startsAt")
  WHERE "status" = 'SCHEDULED';
```

The second insert fails, and the action turns that into "someone just
booked that slot". The `WHERE` clause is what lets a cancelled
appointment stay in history without permanently blocking the slot.
Prisma's schema language cannot express partial indexes, so this goes
into the migration by hand.

### Availability and appointments use different time representations

A recurring weekly window ("Mondays, 09:00–17:00") has no date, so it is
stored as minutes from midnight plus a day-of-week, in the vet's own IANA
timezone. An appointment is a real point in time and is stored as an
absolute UTC instant.

Converting between them goes through the vet's zone explicitly. Doing
that arithmetic in UTC or in the server's local zone is wrong twice a
year at DST boundaries — quietly, and only for some users.

### Clinical notes lock, and corrections are appended

A finalised note cannot be edited. Corrections are separate amendment
records with their own author and timestamp. A clinical record that can
be silently rewritten is not a record: you cannot tell afterwards what
the vet actually knew and said at the time.

Finalising the note and marking the appointment complete happen in one
transaction, because they are the same event.

### Machine-drafted notes never occupy human fields

The transcript and the extraction live on a separate `ConsultationRecording`
row. The vet reads the proposal and accepts fields individually — there
is deliberately no "accept all", because a single button makes it
trivially easy to sign off text nobody read, which is precisely what
makes automated clinical notes dangerous rather than useful.

Accepting appends to what the vet has already written rather than
replacing it.

### The extraction prompt is biased toward returning nothing

Anything not explicitly stated in the transcript comes back null. A
fabricated dose is dangerous in a way a wrong summary is not. Proposed
medications carry the phrase the drug was named in, so the vet can check
a dose against what was actually said rather than trusting the
extraction.

### The assistant's retrieval query *is* its access control

The model has no database connection and no tools. It answers only from a
context block the application assembles, scoped to the signed-in owner.
There is no second line of defence and none is needed, provided that one
query is right — which is a cleaner security story than a tool-calling
agent where the model chooses what to fetch.

Draft notes are excluded from that context: a draft may contain
machine-proposed text the vet has not checked, and quoting it to an owner
as clinical fact would misrepresent it.

### Files are private, and the route is the only door

Uploads go to a private blob store with no publicly fetchable URL. A
request checks that the caller is the owner or a treating vet, then mints
a five-minute signed URL and redirects. An unguessable URL is obscurity,
not access control.

---

## Evaluation

The extraction step has an evaluation harness in the transcription
service repo: transcripts paired with the extraction a vet would consider
correct, scored on three separate axes.

**Field decisions** — did it fill what should be filled and leave null
what should be null? This catches the worst failure, inventing content
for something never discussed.

**Field content** — token F1 on filled fields. A blunt instrument: two
vets would not write the same sentence, so read it as "roughly right"
rather than as a quality score.

**Medications** — drug name precision and recall, and exact-match
accuracy on dose. Kept separate because getting a drug name wrong is bad
and getting a dose wrong is dangerous, and averaging them hides the thing
you most need to see. Dose errors are printed individually.

Cases are chosen to probe failure modes rather than to sample
consultations representatively: a drug the owner mentions but the vet
forbids, a dose the vet states then corrects, a consultation where the
vet explicitly declines to diagnose pending bloods.

---

## Limitations

**No speaker diarisation.** Vet and owner are not distinguished in the
transcript. Adding it needs `pyannote`, a Hugging Face token, and
considerably more compute.

**The deployed transcription model is small.** Render's free tier has
512 MB, which fits Whisper `tiny`. That is noticeably worse than `small`
on drug names — the vocabulary that matters most here.

**Cold starts.** The free instance sleeps after inactivity, so the first
transcription after a quiet period waits for the service to wake.

**Transcription is synchronous.** A long recording holds the request
open. At any real volume this needs a job queue.

**Vaccination schedules are placeholders.** The seeded intervals are
plausible defaults for a demo, not veterinary guidance. Real schedules
vary by region, by law — rabies especially — by manufacturer, and by the
animal's age at first dose.

**Vets are self-certified.** Registration accepts a licence number and
auto-verifies. A real system would check it against a veterinary council
register.

**One database across environments.** Local development and production
share a Neon database, which is convenient and wrong.

---

## Running locally

Requires Node 20+, Python 3.12+, and ffmpeg.

```bash
git clone https://github.com/Prakh4r-S/Pet-health.git
cd Pet-health
npm install
npx prisma migrate deploy
npx prisma db seed
npm run dev
```

`.env` needs:

```
DATABASE_URL                 # Neon, pooled
DIRECT_URL                   # Neon, direct — migrations bypass the pooler
AUTH_SECRET
AUTH_GOOGLE_ID
AUTH_GOOGLE_SECRET
NEXT_PUBLIC_LIVEKIT_URL
LIVEKIT_API_KEY
LIVEKIT_API_SECRET
BLOB_READ_WRITE_TOKEN
TRANSCRIPTION_SERVICE_URL
TRANSCRIPTION_SERVICE_KEY
```

The transcription service runs separately — see its repository.

---

## Stack

Next.js 16 · TypeScript · Prisma 7 · PostgreSQL (Neon) · Auth.js ·
LiveKit · Vercel Blob · Tailwind · Recharts · FastAPI · faster-whisper ·
Gemini
