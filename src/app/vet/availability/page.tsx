import { prisma } from "@/lib/prisma";
import { requireVetProfile } from "@/lib/current-user";
import { addAvailability, addTimeOff, removeAvailability } from "../actions";

const field = "w-full rounded-md border border-gray-300 px-3 py-2 text-sm";
const button = "rounded-md bg-pine-900 px-4 py-2 text-sm text-white hover:bg-pine-700";
const card = "rounded-lg border border-gray-200 p-5";

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function hhmm(minutes: number) {
  const h = String(Math.floor(minutes / 60)).padStart(2, "0");
  const m = String(minutes % 60).padStart(2, "0");
  return `${h}:${m}`;
}

export default async function AvailabilityPage() {
  const { profile } = await requireVetProfile();

  const [windows, timeOff] = await Promise.all([
    prisma.vetAvailability.findMany({
      where: { vetProfileId: profile.id },
      orderBy: [{ dayOfWeek: "asc" }, { startMinute: "asc" }],
    }),
    prisma.vetTimeOff.findMany({
      where: { vetProfileId: profile.id, endsAt: { gte: new Date() } },
      orderBy: { startsAt: "asc" },
    }),
  ]);

  const byDay = DAYS.map((name, day) => ({
    name,
    day,
    windows: windows.filter((w) => w.dayOfWeek === day),
  }));

  const weeklySlots = windows.reduce(
    (total, w) => total + Math.floor((w.endMinute - w.startMinute) / profile.slotMinutes),
    0,
  );

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <h1 className="text-2xl font-semibold">Your availability</h1>
      <p className="mb-8 mt-2 text-sm text-gray-600">
        Weekly hours, in {profile.timezone}. {profile.slotMinutes}-minute appointments
        {weeklySlots > 0 && ` · ${weeklySlots} slots per week`}.
      </p>

      <section className={`${card} mb-6`}>
        <h2 className="mb-4 font-medium">Weekly hours</h2>

        <ul className="divide-y divide-gray-100">
          {byDay.map(({ name, day, windows }) => (
            <li key={day} className="flex items-start justify-between gap-4 py-3">
              <span className="w-28 text-sm font-medium">{name}</span>
              <div className="flex flex-1 flex-wrap gap-2">
                {windows.length === 0 ? (
                  <span className="text-sm text-gray-400">Not available</span>
                ) : (
                  windows.map((w) => (
                    <form key={w.id} action={removeAvailability}>
                      <input type="hidden" name="id" value={w.id} />
                      <button
                        type="submit"
                        title="Remove"
                        className="rounded-full bg-gray-100 px-3 py-1 text-sm hover:bg-red-100 hover:line-through"
                      >
                        {hhmm(w.startMinute)}–{hhmm(w.endMinute)}
                      </button>
                    </form>
                  ))
                )}
              </div>
            </li>
          ))}
        </ul>

        <form action={addAvailability} className="mt-5 flex flex-wrap items-end gap-3">
          <div className="w-40">
            <label className="mb-1 block text-xs text-gray-600" htmlFor="dayOfWeek">Day</label>
            <select id="dayOfWeek" name="dayOfWeek" className={field} defaultValue="1">
              {DAYS.map((d, i) => (
                <option key={d} value={i}>{d}</option>
              ))}
            </select>
          </div>
          <div className="w-32">
            <label className="mb-1 block text-xs text-gray-600" htmlFor="startTime">From</label>
            <input id="startTime" name="startTime" type="time" defaultValue="09:00" className={field} required />
          </div>
          <div className="w-32">
            <label className="mb-1 block text-xs text-gray-600" htmlFor="endTime">To</label>
            <input id="endTime" name="endTime" type="time" defaultValue="17:00" className={field} required />
          </div>
          <button type="submit" className={button}>Add hours</button>
        </form>
        <p className="mt-2 text-xs text-gray-500">
          Click an existing window to remove it. Overlapping windows are merged.
        </p>
      </section>

      <section className={card}>
        <h2 className="mb-4 font-medium">Time off</h2>

        {timeOff.length === 0 ? (
          <p className="text-sm text-gray-400">Nothing scheduled.</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {timeOff.map((t) => (
              <li key={t.id} className="py-3 text-sm">
                {t.startsAt.toISOString().slice(0, 10)} to {t.endsAt.toISOString().slice(0, 10)}
                {t.reason && <span className="text-gray-500"> · {t.reason}</span>}
              </li>
            ))}
          </ul>
        )}

        <form action={addTimeOff} className="mt-5 flex flex-wrap items-end gap-3">
          <div className="w-44">
            <label className="mb-1 block text-xs text-gray-600" htmlFor="startsAt">From</label>
            <input id="startsAt" name="startsAt" type="date" className={field} required />
          </div>
          <div className="w-44">
            <label className="mb-1 block text-xs text-gray-600" htmlFor="endsAt">To</label>
            <input id="endsAt" name="endsAt" type="date" className={field} required />
          </div>
          <div className="w-48">
            <label className="mb-1 block text-xs text-gray-600" htmlFor="reason">Reason (optional)</label>
            <input id="reason" name="reason" className={field} />
          </div>
          <button type="submit" className={button}>Add</button>
        </form>
      </section>
    </main>
  );
}
