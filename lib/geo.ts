import "server-only";
import { prisma } from "@/lib/prisma";

/** Kwa Daggy, Ndumbuini, Upper Kabete — the courier's fixed pickup point (pin confirmed on Google Maps). */
export const PICKUP_COORDS = { lat: -1.2488419, lon: 36.7228642 };

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
 * Coordinates for a store, geocoded once from its address (or name as a fallback)
 * via OpenStreetMap's free Nominatim service, then cached on the Store row — later
 * calls for the same store skip the network call entirely.
 */
export async function getStoreCoords(store: {
  id: number;
  name: string;
  county: string;
  address: string;
  lat: number | null;
  lng: number | null;
}): Promise<{ lat: number; lon: number } | null> {
  if (store.lat != null && store.lng != null) return { lat: store.lat, lon: store.lng };

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

  let coords: { lat: number; lon: number } | null = null;
  for (const query of candidates) {
    coords = await geocode(query);
    if (coords) break;
  }
  if (coords) {
    await prisma.store.update({ where: { id: store.id }, data: { lat: coords.lat, lng: coords.lon } }).catch(() => {});
  }
  return coords;
}

/** Straight-line distance (km) from the pickup point to a store, rounded to 1 decimal. */
export function distanceKm(storeCoords: { lat: number; lon: number }): number {
  return Math.round(haversineKm(PICKUP_COORDS, storeCoords) * 10) / 10;
}

/**
 * A Google Maps "get directions" link from the pickup point to the store — opens
 * straight into turn-by-turn driving directions, no account or API key needed.
 * Falls back to a text destination (Maps geocodes it itself) when coordinates
 * aren't available yet.
 */
export function mapsDirectionsUrl(destination: { lat: number; lon: number } | string): string {
  const dest = typeof destination === "string" ? destination : `${destination.lat},${destination.lon}`;
  const origin = `${PICKUP_COORDS.lat},${PICKUP_COORDS.lon}`;
  return `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(
    dest
  )}&travelmode=driving`;
}
