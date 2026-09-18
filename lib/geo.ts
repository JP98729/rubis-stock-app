import "server-only";
import { prisma } from "@/lib/prisma";

/** Upper Kabete, Ndumbuini, Kwa Daggy, Nairobi — the courier's fixed pickup point. */
export const PICKUP_COORDS = { lat: -1.2581618, lon: 36.7249076 };

const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";
const USER_AGENT = "RubisEnjoyStockApp/1.0 (jprsfortain@gmail.com)";

/** Great-circle ("as the crow flies") distance in km — not a driving-route distance. */
export function haversineKm(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLon = ((b.lon - a.lon) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
}

async function geocode(query: string): Promise<{ lat: number; lon: number } | null> {
  try {
    const url = `${NOMINATIM_URL}?format=json&limit=1&countrycodes=ke&q=${encodeURIComponent(query)}`;
    const res = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
    if (!res.ok) return null;
    const rows = (await res.json()) as Array<{ lat: string; lon: string }>;
    if (!rows.length) return null;
    return { lat: parseFloat(rows[0].lat), lon: parseFloat(rows[0].lon) };
  } catch {
    return null;
  }
}

/**
 * Straight-line distance (km) from the pickup point to a store, rounded to 1 decimal.
 * Geocodes the store's address (or name as a fallback) once via OpenStreetMap's free
 * Nominatim service, then caches the result on the Store row — later calls for the
 * same store skip the network call entirely.
 */
export async function distanceKmToPickup(store: {
  id: number;
  name: string;
  county: string;
  address: string;
  lat: number | null;
  lng: number | null;
}): Promise<number | null> {
  let coords: { lat: number; lon: number } | null =
    store.lat != null && store.lng != null ? { lat: store.lat, lon: store.lng } : null;

  if (!coords) {
    const county = store.county.trim();
    // Some seeded stores have a bogus county ("Unknown"), which pollutes the search
    // and returns zero results — so each candidate is tried without it too.
    const hasRealCounty = !!county && county.toLowerCase() !== "unknown";
    const candidates = [
      store.address.trim() && hasRealCounty ? `${store.address.trim()}, ${county}, Kenya` : null,
      store.address.trim() ? `${store.address.trim()}, Kenya` : null,
      hasRealCounty ? `${store.name.trim()}, ${county}, Kenya` : null,
      `${store.name.trim()}, Kenya`,
    ].filter((q): q is string => !!q);

    for (const query of candidates) {
      coords = await geocode(query);
      if (coords) break;
    }
    if (coords) {
      await prisma.store.update({ where: { id: store.id }, data: { lat: coords.lat, lng: coords.lon } }).catch(() => {});
    }
  }

  if (!coords) return null;
  return Math.round(haversineKm(PICKUP_COORDS, coords) * 10) / 10;
}
