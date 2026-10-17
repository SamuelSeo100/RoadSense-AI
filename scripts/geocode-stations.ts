/// <reference types="node" />
/**
 * Fills station coordinates in data/transit/metro.json (28 stations) and
 * suburban_rail.json (17 stations) with Google Places API (New) Text Search,
 * re-estimates metro segment run times from them, and prints a review table
 * (code → name → lat,lng → formatted address) to catch wrong matches.
 *
 *   node --env-file=.env scripts/geocode-stations.ts            # stations not geocoded yet
 *   node --env-file=.env scripts/geocode-stations.ts --force    # all stations again
 *   node --env-file=.env scripts/geocode-stations.ts --dry-run  # print, don't write
 *
 * Key: GOOGLE_MAPS_API_KEY or EXPO_PUBLIC_GOOGLE_MAPS_API_KEY from the
 * environment (never hard-coded). One request per station. A station whose
 * plain name matches the wrong place can carry a `geocodeQuery` override.
 */
import fs from 'node:fs';
import path from 'node:path';

import { lineSegmentMinutes } from '../src/services/transit/buildMetro.ts';
import type { Geocoded, MetroNetwork } from '../src/services/transit/types.ts';

type Station = Geocoded & { code: string; name: string };

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
  error?: { message?: string };
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
  const json = (await res.json()) as TextSearchResponse;
  if (!res.ok) throw new Error(json.error?.message ?? `Places request failed (${res.status})`);
  return json.places?.[0] ?? null;
}

interface Row {
  file: string;
  station: Station;
  match: string;
  flag: string;
}

/** Geocodes `stations` in place; returns review rows and the number of requests. */
async function geocode(file: string, stations: Station[], queryOf: (s: Station) => string) {
  const rows: Row[] = [];
  let requests = 0;
  for (const s of stations) {
    if (s.geocoded && !force) {
      rows.push({ file, station: s, match: s.geocodeSource ?? '', flag: 'kept' });
      continue;
    }
    const query = s.geocodeQuery ?? queryOf(s);
    requests++;
    const place = await search(query);
    if (!place?.location) {
      Object.assign(s, { lat: null, lng: null, geocoded: false });
      rows.push({ file, station: s, match: `"${query}" → no match`, flag: 'NO MATCH' });
      continue;
    }
    const km = haversineKm(PUNE, place.location);
    Object.assign(s, {
      lat: Math.round(place.location.latitude * 1e6) / 1e6,
      lng: Math.round(place.location.longitude * 1e6) / 1e6,
      geocoded: true,
      formattedAddress: place.formattedAddress ?? '',
      geocodeSource: `Places Text Search "${query}" → "${place.displayName?.text ?? ''}" (TODO_VERIFY: review)`,
    });
    rows.push({
      file,
      station: s,
      match: place.displayName?.text ?? '',
      flag: km > MAX_KM ? `FAR (${Math.round(km)} km)` : '',
    });
  }
  return { rows, requests };
}

/** Same coordinates for two different stations: at least one is wrong. */
function flagDuplicates(rows: Row[]) {
  const seen = new Map<string, Row>();
  for (const r of rows) {
    const s = r.station;
    if (s.lat == null) continue;
    const k = `${r.file}|${s.lat.toFixed(4)},${s.lng?.toFixed(4)}`;
    const other = seen.get(k);
    if (other) {
      r.flag ||= `SAME AS ${other.station.code}`;
      other.flag ||= `SAME AS ${s.code}`;
    } else seen.set(k, r);
  }
}

async function main() {
  if (!key) {
    console.error(
      'Set GOOGLE_MAPS_API_KEY or EXPO_PUBLIC_GOOGLE_MAPS_API_KEY (e.g. --env-file=.env).',
    );
    process.exit(1);
  }
  const metroPath = path.join(DATA, 'metro.json');
  const subPath = path.join(DATA, 'suburban_rail.json');
  const metro = JSON.parse(fs.readFileSync(metroPath, 'utf8')) as MetroNetwork;
  const sub = JSON.parse(fs.readFileSync(subPath, 'utf8')) as { stations: Station[] };

  const m = await geocode('metro', metro.stations, (s) => `${s.name} metro station Pune`);
  const r = await geocode('rail', sub.stations, (s) => `${s.name} railway station`);
  const rows = [...m.rows, ...r.rows];
  flagDuplicates(rows);

  // Segment run times follow the coordinates (verified values are kept).
  for (const line of metro.lines) {
    const estimates = lineSegmentMinutes(line, metro.stations);
    line.segmentMinutes = estimates.map((e, i) =>
      line.segmentMinutes[i]?.verified ? line.segmentMinutes[i]! : e,
    );
  }

  console.log('| system | code | name | lat, lng | matched place | formatted address | flag |');
  console.log('|---|---|---|---|---|---|---|');
  for (const { file, station: s, match, flag } of rows) {
    const coords = s.lat == null ? '—' : `${s.lat}, ${s.lng}`;
    const matched = match.match(/→ "(.*)"/)?.[1] ?? match;
    console.log(
      `| ${file} | ${s.code} | ${s.name} | ${coords} | ${matched} | ${s.formattedAddress ?? ''} | ${flag} |`,
    );
  }
  console.log(
    `\n${m.requests + r.requests} Places requests${dryRun ? ' (dry run, nothing written)' : ''}.`,
  );
  if (!dryRun) {
    fs.writeFileSync(metroPath, JSON.stringify(metro, null, 2) + '\n');
    fs.writeFileSync(subPath, JSON.stringify(sub, null, 2) + '\n');
  }
}

void main();
