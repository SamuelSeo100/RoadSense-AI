import type { Fix } from '../engine';
import type { LatLng, NavStep } from '../steps';

const ORIGIN = { latitude: 18.5, longitude: 73.8 };
const M_PER_DEG = 111_195;

/** A point `east` / `north` metres from a fixed origin in Pune. */
export const at = (east: number, north = 0): LatLng => ({
  latitude: ORIGIN.latitude + north / M_PER_DEG,
  longitude: ORIGIN.longitude + east / (M_PER_DEG * Math.cos((ORIGIN.latitude * Math.PI) / 180)),
});

export const fix = (
  p: LatLng,
  tSec: number,
  over: Partial<Omit<Fix, 'lat' | 'lng' | 't'>> = {},
): Fix => ({
  lat: p.latitude,
  lng: p.longitude,
  accuracy: 8,
  speed: null,
  heading: null,
  t: tSec * 1000,
  ...over,
});

let n = 0;
export function step(over: Partial<NavStep> & Pick<NavStep, 'polyline'>): NavStep {
  const { polyline } = over;
  return {
    id: `s${n++}`,
    kind: 'walk',
    instruction: 'Walk',
    endPoint: polyline[polyline.length - 1]!,
    distanceM: 0,
    predictedDurationS: 60,
    source: 'google',
    legIndex: 0,
    legMode: 'walk',
    ...over,
  };
}
