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
 * How finely a position is kept.
 *
 * `area` is three decimal places, roughly a hundred metres: plenty to
 * rank vets by distance, and not a record of which building someone
 * lives in. `exact` is five, about a metre, for a clinic — a public
 * address that people need to find.
 */
const DECIMALS = { area: 3, exact: 5 } as const;

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
 * field names are fixed. A clinic also gets the coordinates as visible
 * fields (`manualCoordinates`): whoever is filling the form in is often
 * not standing in the clinic, and can copy the pair from a map instead.
 */
export default function LocationFields({
  defaults,
  precision = "area",
  buttonLabel = "Use my current location",
  manualCoordinates = false,
  hint,
}: {
  precision?: keyof typeof DECIMALS;
  buttonLabel?: string;
  manualCoordinates?: boolean;
  /** One line under the controls saying what the location is for. */
  hint: React.ReactNode;
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
  const [coords, setCoords] = useState({
    latitude: defaults.latitude != null ? String(defaults.latitude) : "",
    longitude: defaults.longitude != null ? String(defaults.longitude) : "",
  });
  const hasCoords = coords.latitude !== "" && coords.longitude !== "";
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
        const latitude = position.coords.latitude.toFixed(DECIMALS[precision]);
        const longitude = position.coords.longitude.toFixed(DECIMALS[precision]);
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
      {!manualCoordinates && (
        <>
          <input type="hidden" name="latitude" value={coords.latitude} />
          <input type="hidden" name="longitude" value={coords.longitude} />
        </>
      )}

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
            {locating ? "Finding your location..." : buttonLabel}
          </button>

          <p role="status" className="text-sm text-ink-soft">
            {hasCoords ? (
              <>
                Location set ({coords.latitude}, {coords.longitude}).{" "}
                <button
                  type="button"
                  onClick={() => setCoords({ latitude: "", longitude: "" })}
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

        {manualCoordinates && (
          <div className="mt-4 grid max-w-sm grid-cols-2 gap-4">
            <div>
              <label className={label} htmlFor="latitude">Latitude</label>
              <input
                id="latitude"
                name="latitude"
                className={field}
                value={coords.latitude}
                onChange={(e) => setCoords((c) => ({ ...c, latitude: e.target.value }))}
                inputMode="decimal"
                placeholder="12.97160"
              />
            </div>
            <div>
              <label className={label} htmlFor="longitude">Longitude</label>
              <input
                id="longitude"
                name="longitude"
                className={field}
                value={coords.longitude}
                onChange={(e) => setCoords((c) => ({ ...c, longitude: e.target.value }))}
                inputMode="decimal"
                placeholder="77.59460"
              />
            </div>
          </div>
        )}

        {status.phase === "error" && (
          <p role="alert" className="mt-2 text-sm text-red-900">
            {status.message}
          </p>
        )}

        <p className="mt-2 text-xs text-ink-soft">{hint}</p>
      </div>
    </div>
  );
}
