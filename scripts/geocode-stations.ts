/// <reference types="node" />
/**
 * Fills station coordinates in data/transit/metro.json and suburban_rail.json
 * with Google Places API (New) Text Search, then prints a review table
 * (name → coordinates → formatted address) to catch wrong matches.
 *
 *   node --env-file=.env scripts/geocode-stations.ts            # stations not geocoded yet
 *   node --env-file=.env scripts/geocode-stations.ts --force    # all stations again
 *   node --env-file=.env scripts/geocode-stations.ts --dry-run  # print, don't write
 *
 * Key: GOOGLE_MAPS_API_KEY or EXPO_PUBLIC_GOOGLE_MAPS_API_KEY from the
 * environment (never hard-coded). One request per station.
 */
import fs from 'node:fs';
import path from 'node:path';

interface Station {
  id: string;
  name: string;
  lat: number | null;
  lng: number | null;
  geocoded: boolean;
  verified: boolean;
  source: string;
  formattedAddress?: string;
  /** Overrides the default query when the plain name matches the wrong place. */
  geocodeQuery?: string;
}

const DATA = path.join(import.meta.dirname, '..', 'data', 'transit');
const PUNE = { latitude: 18.5204, longitude: 73.8567 };
/** Further than this from Pune centre is certainly a wrong match (Lonavala is ~55 km). */
const MAX_KM = 75;

const key = process.env.GOOGLE_MAPS_API_KEY || process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;
const force = process.argv.includes('--force');
const dryRun = process.argv.includes('--dry-run');

function haversineKm(a: { latitude: number; longitude: number }, b: typeof a): number {
  const rad = Math.PI / 180;
  const dLat = (b.latitude - a.latitude) * rad;
  const dLng = (b.longitude - a.longitude) * rad;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(a.latitude * rad) * Math.cos(b.latitude * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

interface TextSearchResponse {
  places?: {
    displayName?: { text?: string };
    formattedAddress?: string;
    location?: { latitude: number; longitude: number };
  }[];
}

async function search(query: string) {
  const res = await fetch('https://places.googleapis.com/v1/places:searchText', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': key ?? '',
      'X-Goog-FieldMask': 'places.displayName,places.formattedAddress,places.location',
      // Same app identity as the app's requests, for keys restricted to Android apps.
      'X-Android-Package': 'in.routly.app',
      ...(process.env.EXPO_PUBLIC_ANDROID_CERT_SHA1
        ? { 'X-Android-Cert': process.env.EXPO_PUBLIC_ANDROID_CERT_SHA1.replace(/:/g, '') }
        : {}),
    },
    body: JSON.stringify({
      textQuery: query,
      regionCode: 'IN',
      languageCode: 'en',
      pageSize: 1,
      locationBias: { circle: { center: PUNE, radius: 50000 } },
    }),
  });
  const json = (await res.json()) as TextSearchResponse & { error?: { message?: string } };
  if (!res.ok) throw new Error(json.error?.message ?? `Places request failed (${res.status})`);
  return json.places?.[0] ?? null;
}

interface Row {
  file: string;
  name: string;
  query: string;
  coords: string;
  address: string;
  flag: string;
}

async function geocodeFile(
  file: string,
  stationsOf: (data: any) => Station[],
  queryOf: (s: Station, data: any) => string,
): Promise<Row[]> {
  const fullPath = path.join(DATA, file);
  const data = JSON.parse(fs.readFileSync(fullPath, 'utf8'));
  const rows: Row[] = [];
  for (const station of stationsOf(data)) {
    const query = queryOf(station, data);
    if (station.geocoded && !force) {
      rows.push({
        file,
        name: station.name,
        query,
        coords: `${station.lat}, ${station.lng}`,
        address: station.formattedAddress ?? '',
        flag: 'kept',
      });
      continue;
    }
    const place = await search(query);
    if (!place?.location) {
      rows.push({ file, name: station.name, query, coords: '—', address: '', flag: 'NO MATCH' });
      continue;
    }
    const km = haversineKm(PUNE, place.location);
    station.lat = Math.round(place.location.latitude * 1e6) / 1e6;
    station.lng = Math.round(place.location.longitude * 1e6) / 1e6;
    station.geocoded = true;
    station.verified = false;
    station.formattedAddress = place.formattedAddress ?? '';
    station.source = `Google Places Text Search "${query}" → "${place.displayName?.text ?? ''}" (TODO_VERIFY: review match)`;
    rows.push({
      file,
      name: station.name,
      query,
      coords: `${station.lat}, ${station.lng}`,
      address: `${place.displayName?.text ?? ''} | ${place.formattedAddress ?? ''}`,
      flag: km > MAX_KM ? `FAR (${Math.round(km)} km)` : '',
    });
  }
  if (!dryRun) fs.writeFileSync(fullPath, JSON.stringify(data, null, 2) + '\n');
  return rows;
}

async function main() {
  if (!key) {
    console.error(
      'Set GOOGLE_MAPS_API_KEY or EXPO_PUBLIC_GOOGLE_MAPS_API_KEY (e.g. --env-file=.env).',
    );
    process.exit(1);
  }
  const rows = [
    ...(await geocodeFile(
      'metro.json',
      (d) => d.lines.flatMap((l: { stations: Station[] }) => l.stations),
      (s) => s.geocodeQuery ?? `${s.name} metro station, Pune`,
    )),
    ...(await geocodeFile(
      'suburban_rail.json',
      (d) => d.stations,
      (s) => `${s.name.replace(/ Jn$/, ' Junction')} railway station, Maharashtra`,
    )),
  ];
  console.log('| file | station | coordinates | matched place | address | flag |');
  console.log('|---|---|---|---|---|---|');
  for (const r of rows) {
    const [name, address] = r.address.split(' | ');
    console.log(
      `| ${r.file} | ${r.name} | ${r.coords} | ${name ?? ''} | ${address ?? ''} | ${r.flag} |`,
    );
  }
  const requests = rows.filter((r) => r.flag !== 'kept').length;
  console.log(`\n${requests} Places requests${dryRun ? ' (dry run, nothing written)' : ''}.`);
}

void main();
