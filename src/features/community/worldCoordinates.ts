/**
 * Approximate lat/lon for the cities and country centroids used by the
 * community map. Phase 1 keeps this list curated by hand — it covers the
 * cities seeded in supabase/fixtures/sample_employees.sql and the country
 * fallbacks for everything else. A future iteration can swap in a proper
 * geocoder when more attendees enter free-form cities.
 */

export interface LatLon {
  lat: number;
  lon: number;
}

const CITIES: Record<string, LatLon> = {
  // North America
  'san francisco|us': { lat: 37.7749, lon: -122.4194 },
  'new york|us': { lat: 40.7128, lon: -74.006 },
  'austin|us': { lat: 30.2672, lon: -97.7431 },
  'miami|us': { lat: 25.7617, lon: -80.1918 },
  'los angeles|us': { lat: 34.0522, lon: -118.2437 },
  'las vegas|us': { lat: 36.1716, lon: -115.1391 },
  'albuquerque|us': { lat: 35.0844, lon: -106.6504 },
  'springfield|us': { lat: 39.7817, lon: -89.6501 },
  'boston|us': { lat: 42.3601, lon: -71.0589 },
  'chicago|us': { lat: 41.8781, lon: -87.6298 },
  'phoenix|us': { lat: 33.4484, lon: -112.074 },
  'seattle|us': { lat: 47.6062, lon: -122.3321 },
  'dallas|us': { lat: 32.7767, lon: -96.797 },
  'atlanta|us': { lat: 33.749, lon: -84.388 },
  'denver|us': { lat: 39.7392, lon: -104.9903 },
  'san diego|us': { lat: 32.7157, lon: -117.1611 },
  'houston|us': { lat: 29.7604, lon: -95.3698 },
  'portland|us': { lat: 45.5152, lon: -122.6784 },
  'minneapolis|us': { lat: 44.9778, lon: -93.265 },
  'toronto|ca': { lat: 43.6532, lon: -79.3832 },
  'banff|ca': { lat: 51.1784, lon: -115.5708 },
  'mexico city|mx': { lat: 19.4326, lon: -99.1332 },
  // Europe
  'london|gb': { lat: 51.5074, lon: -0.1278 },
  'manchester|gb': { lat: 53.4808, lon: -2.2426 },
  'edinburgh|gb': { lat: 55.9533, lon: -3.1883 },
  'cardiff|gb': { lat: 51.4816, lon: -3.1791 },
  'birmingham|gb': { lat: 52.4862, lon: -1.8904 },
  'cambridge|gb': { lat: 52.2053, lon: 0.1218 },
  'devon|gb': { lat: 50.7156, lon: -3.5309 },
  'paris|fr': { lat: 48.8566, lon: 2.3522 },
  'berlin|de': { lat: 52.52, lon: 13.405 },
  'lisbon|pt': { lat: 38.7169, lon: -9.139 },
  'naboo|it': { lat: 41.9028, lon: 12.4964 },
  // Asia / Oceania
  'tokyo|jp': { lat: 35.6762, lon: 139.6503 },
  'hong kong|hk': { lat: 22.3193, lon: 114.1694 },
  'sydney|au': { lat: -33.8688, lon: 151.2093 },
  'bengaluru|in': { lat: 12.9716, lon: 77.5946 },
};

const COUNTRY_CENTROIDS: Record<string, LatLon> = {
  us: { lat: 39.5, lon: -98.35 },
  ca: { lat: 56.13, lon: -106.35 },
  mx: { lat: 23.63, lon: -102.55 },
  gb: { lat: 54.7, lon: -3.28 },
  fr: { lat: 46.23, lon: 2.21 },
  de: { lat: 51.17, lon: 10.45 },
  it: { lat: 41.87, lon: 12.57 },
  pt: { lat: 39.4, lon: -8.22 },
  jp: { lat: 36.2, lon: 138.25 },
  in: { lat: 20.59, lon: 78.96 },
  hk: { lat: 22.32, lon: 114.17 },
  au: { lat: -25.27, lon: 133.78 },
};

function key(city: string, country: string): string {
  return `${city.trim().toLowerCase()}|${country.toLowerCase()}`;
}

/**
 * Resolves a (city, country) pair to lat/lon, falling back to the country
 * centroid for unknown cities and returning null when neither resolves.
 */
export function locate(city: string | null, country: string | null): LatLon | null {
  if (!country) return null;
  const cc = country.toLowerCase();
  if (city) {
    const found = CITIES[key(city, cc)];
    if (found) return found;
  }
  return COUNTRY_CENTROIDS[cc] ?? null;
}

/**
 * Equirectangular projection: lat/lon → 0..1 box coordinates. Width is
 * the x dimension, height the y. Origin is top-left.
 */
export function project(point: LatLon, width: number, height: number): { x: number; y: number } {
  return {
    x: ((point.lon + 180) / 360) * width,
    y: ((90 - point.lat) / 180) * height,
  };
}
