"use client";

import { useState } from "react";

const field = "w-full rounded-md border border-mist-deep px-3 py-2 text-sm";
const label = "mb-1 block text-sm font-medium";

type Status =
  | { phase: "idle" }
  | { phase: "locating" }
  | { phase: "error"; message: string };

type Place = { city: string; state: string; postalCode: string };

/**
 * Three decimal places is roughly a hundred metres: plenty to rank vets
 * by distance, and not a record of which building someone lives in.
 */
function coarse(degrees: number) {
  return degrees.toFixed(3);
}

/**
 * Turns coordinates into a city, state and postal code using
 * OpenStreetMap's Nominatim. Best effort: if it fails, the coordinates
 * are still saved and the text fields are left for the person to fill.
 */
async function reverseGeocode(latitude: string, longitude: string): Promise<Partial<Place>> {
  const url = new URL("https://nominatim.openstreetmap.org/reverse");
  url.search = new URLSearchParams({
    format: "jsonv2",
    lat: latitude,
    lon: longitude,
    zoom: "14",
    addressdetails: "1",
  }).toString();

  const response = await fetch(url, { signal: AbortSignal.timeout(8000) });
  if (!response.ok) return {};

  const { address = {} } = (await response.json()) as {
    address?: Record<string, string | undefined>;
  };

  return {
    city:
      address.city ?? address.town ?? address.village ?? address.suburb ?? address.county,
    state: address.state ?? address.region,
    postalCode: address.postcode,
  };
}

function geolocationMessage(error: GeolocationPositionError) {
  if (error.code === error.PERMISSION_DENIED) {
    return "Location access was blocked. Allow it in your browser, or type your city instead.";
  }
  if (error.code === error.TIMEOUT) return "Finding your location took too long. Try again.";
  return "Your location could not be determined. Type your city instead.";
}

/**
 * Where someone is: city, state and postal code as text, plus a pair of
 * coordinates in hidden inputs.
 *
 * The text is what people read; the coordinates are what distance is
 * measured from. "Use my current location" sets the coordinates from the
 * browser and fills the text from them, and both remain editable — the
 * lookup is sometimes wrong about which town a suburb belongs to.
 *
 * Shared by the owner profile and the clinic profile, which is why the
 * field names are fixed.
 */
export default function LocationFields({
  defaults,
}: {
  defaults: {
    city: string | null;
    state: string | null;
    postalCode: string | null;
    latitude: number | null;
    longitude: number | null;
  };
}) {
  const [place, setPlace] = useState<Place>({
    city: defaults.city ?? "",
    state: defaults.state ?? "",
    postalCode: defaults.postalCode ?? "",
  });
  const [coords, setCoords] = useState(
    defaults.latitude != null && defaults.longitude != null
      ? { latitude: String(defaults.latitude), longitude: String(defaults.longitude) }
      : null,
  );
  const [status, setStatus] = useState<Status>({ phase: "idle" });
  const locating = status.phase === "locating";

  const locate = () => {
    if (!("geolocation" in navigator)) {
      setStatus({
        phase: "error",
        message: "This browser cannot share a location. Type your city instead.",
      });
      return;
    }

    setStatus({ phase: "locating" });

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const latitude = coarse(position.coords.latitude);
        const longitude = coarse(position.coords.longitude);
        setCoords({ latitude, longitude });

        try {
          const found = await reverseGeocode(latitude, longitude);
          setPlace((current) => ({
            city: found.city ?? current.city,
            state: found.state ?? current.state,
            postalCode: found.postalCode ?? current.postalCode,
          }));
        } catch {
          // The coordinates are what matter; the text can be typed.
        }
        setStatus({ phase: "idle" });
      },
      (error) => setStatus({ phase: "error", message: geolocationMessage(error) }),
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 10 * 60 * 1000 },
    );
  };

  const set = (key: keyof Place) => (event: React.ChangeEvent<HTMLInputElement>) =>
    setPlace((current) => ({ ...current, [key]: event.target.value }));

  return (
    <div className="grid gap-4 sm:grid-cols-3">
      <input type="hidden" name="latitude" value={coords?.latitude ?? ""} />
      <input type="hidden" name="longitude" value={coords?.longitude ?? ""} />

      <div>
        <label className={label} htmlFor="city">City</label>
        <input
          id="city"
          name="city"
          className={field}
          value={place.city}
          onChange={set("city")}
          maxLength={80}
          autoComplete="address-level2"
        />
      </div>
      <div>
        <label className={label} htmlFor="state">State</label>
        <input
          id="state"
          name="state"
          className={field}
          value={place.state}
          onChange={set("state")}
          maxLength={80}
          autoComplete="address-level1"
        />
      </div>
      <div>
        <label className={label} htmlFor="postalCode">Postal code</label>
        <input
          id="postalCode"
          name="postalCode"
          className={field}
          value={place.postalCode}
          onChange={set("postalCode")}
          maxLength={12}
          autoComplete="postal-code"
        />
      </div>

      <div className="sm:col-span-3">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <button
            type="button"
            onClick={locate}
            disabled={locating}
            aria-busy={locating}
            className="rounded-md border border-mist-deep px-3 py-1.5 text-sm text-navy-700 hover:text-navy-900 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {locating ? "Finding your location..." : "Use my current location"}
          </button>

          <p role="status" className="text-sm text-ink-soft">
            {coords ? (
              <>
                Location set ({coords.latitude}, {coords.longitude}).{" "}
                <button
                  type="button"
                  onClick={() => setCoords(null)}
                  className="text-navy-700 underline hover:text-navy-900"
                >
                  Clear
                </button>
              </>
            ) : (
              "No location set."
            )}
          </p>
        </div>

        {status.phase === "error" && (
          <p role="alert" className="mt-2 text-sm text-red-900">
            {status.message}
          </p>
        )}

        <p className="mt-2 text-xs text-ink-soft">
          Used to suggest vets near you. Your position is rounded to about 100 m,
          and looked up with OpenStreetMap to fill in the city. Save to keep it.
        </p>
      </div>
    </div>
  );
}
