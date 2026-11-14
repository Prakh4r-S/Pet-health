/**
 * Coordinates and the distance between them. No server-only imports:
 * forms validate with this in the browser's server actions and pages
 * measure with it.
 */

export type Coordinates = { latitude: number; longitude: number };

/**
 * Reads a latitude/longitude pair from a submitted form.
 *
 * `null` means no location was given; `false` means what was given is
 * not a position. A pair or nothing — half a position is no use to
 * anything that measures distance.
 */
export function parseCoordinates(formData: FormData): Coordinates | null | false {
  const latitudeRaw = String(formData.get("latitude") ?? "").trim();
  const longitudeRaw = String(formData.get("longitude") ?? "").trim();
  if (!latitudeRaw && !longitudeRaw) return null;
  if (!latitudeRaw || !longitudeRaw) return false;

  const latitude = Number(latitudeRaw);
  const longitude = Number(longitudeRaw);
  const valid =
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    Math.abs(latitude) <= 90 &&
    Math.abs(longitude) <= 180;

  return valid ? { latitude, longitude } : false;
}

/** Both halves present, or null. */
export function toCoordinates(place: {
  latitude: number | null;
  longitude: number | null;
}): Coordinates | null {
  return place.latitude != null && place.longitude != null
    ? { latitude: place.latitude, longitude: place.longitude }
    : null;
}

const EARTH_RADIUS_KM = 6371;
const radians = (degrees: number) => (degrees * Math.PI) / 180;

/**
 * Great-circle distance in kilometres (haversine). As the crow flies,
 * not by road — good for "which is nearer", not for travel time.
 */
export function distanceKm(a: Coordinates, b: Coordinates) {
  const dLat = radians(b.latitude - a.latitude);
  const dLon = radians(b.longitude - a.longitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(radians(a.latitude)) * Math.cos(radians(b.latitude)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * "under 1 km", "3.4 km", "27 km". An owner's position is only stored to
 * about 100 m, so nothing finer than a tenth of a kilometre is claimed.
 */
export function formatDistance(km: number) {
  if (km < 1) return "under 1 km";
  if (km < 10) return `${km.toFixed(1)} km`;
  return `${Math.round(km).toLocaleString("en-IN")} km`;
}
