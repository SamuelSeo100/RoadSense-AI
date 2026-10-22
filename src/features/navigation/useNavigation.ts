import * as Crypto from 'expo-crypto';
import { useCallback, useEffect, useRef, useState } from 'react';

import { NavigationEngine, type Fix, type NavEvent } from '@/navigation/engine';
import { alightBackupAt } from '@/navigation/alightBackup';
import { distanceM } from '@/navigation/geo';
import { simConfig, simulatedFix, simulationPlan } from '@/navigation/simulate';
import { modeFamily, pickReroute, routeToSteps, type NavStep } from '@/navigation/steps';
import {
  buildTripTrack,
  TrackRecorder,
  type EndReason,
  type TripTrackRow,
} from '@/navigation/tripTrack';
import {
  directionsService,
  locationService,
  routingService,
  tripLogService,
  type FixMode,
  type LatLng,
  type Route,
  type Vehicle,
} from '@/services';
import { useAuthStore } from '@/store/authStore';
import { useRoutlyPrefs } from '@/store/routlyPrefsStore';

import { clearActiveTrip, saveActiveTrip } from './activeTrip';
import { alightAlertNow, cancelAlert, prepareAlerts, scheduleAlightBackup } from './alerts';
import type { NavigationRequest } from './navigationStore';
import { useResearchConsent } from './researchConsent';
import { phraseFor, say, silence } from './voice';

const NO_VEHICLES: Record<Vehicle, boolean> = { car: false, bike: false, cycle: false };
/** Below this the GPS heading is noise (standing still). */
const HEADING_MIN_SPEED = 1;

/** In-app banner for a ride: "Get off soon" (once), then "Your stop is next". */
export interface RideAlert {
  kind: 'alightSoon' | 'stopNext';
  stop: string;
}

export interface NavigationView {
  status: 'navigating' | 'arrived' | 'ended';
  step: NavStep | null;
  /** Every step of the current route, and the current one's index (map, next-leg preview). */
  steps: readonly NavStep[];
  index: number;
  /** Straight-line metres to the end of the current step. */
  stepDistanceM: number | null;
  /** To the end of the current leg (its remaining steps). */
  legRemainingM: number;
  legRemainingS: number;
  /** Along-line metres done on the current step (rides: stops left). */
  progressM: number;
  boarded: boolean;
  remainingM: number;
  /** ms since epoch. */
  arrivalAt: number;
  position: LatLng | null;
  heading: number | null;
  /** Remaining path per step (current step from the user on). */
  remainingPaths: { step: NavStep; path: LatLng[] }[];
  rerouting: boolean;
  offRoute: boolean;
  /** A reroute can be asked for now (per-trip cap, 30 s apart). */
  canReroute: boolean;
  hasNextLeg: boolean;
  alert: RideAlert | null;
  /** No location permission: the trip goes on with "Next leg". */
  locationDenied: boolean;
  simulated: boolean;
}

/**
 * Runs one navigated trip: foreground GPS (or the demo simulation) → engine →
 * voice, alerts, reroutes on request, and the trip_tracks row (written once
 * when it ends; saved on the device meanwhile in case the app is killed).
 * Nothing is logged while simulating or with "Learn from my trips" off.
 */
export function useNavigation(request: NavigationRequest) {
  const { route, destination } = request;
  const simulate = request.simulate === true;
  const [view, setView] = useState<NavigationView | null>(null);
  const [muted, setMuted] = useState(false);
  const [simSpeed, setSimSpeed] = useState<number>(simConfig.speeds[1]);
  /** Read by the GPS callback (outside render). */
  const mutedRef = useRef(false);
  const simSpeedRef = useRef<number>(simSpeed);
  const finishRef = useRef<(reason: EndReason) => void>(() => {});
  const rerouteRef = useRef<() => void>(() => {});
  const nextLegRef = useRef<() => void>(() => {});

  useEffect(() => {
    const firstSteps = routeToSteps(route, destination);
    const engine = new NavigationEngine(firstSteps, destination.location);
    const stepsByVersion: NavStep[][] = [firstSteps];
    const startedAt = request.startedAt;
    const recorder = new TrackRecorder(startedAt);
    const userId = useAuthStore.getState().user?.id ?? null;
    const trackId = Crypto.randomUUID();
    // Research logging: never for a demo, and only with "Learn from my trips" on.
    const logging = !simulate && (useRoutlyPrefs.getState().prefs?.learnFromTrips ?? true);
    let lastFix: Fix | null = null;
    let heading: number | null = null;
    let rerouting = false;
    let finished = false;
    let alert: RideAlert | null = null;
    let locationDenied = false;
    let alightBackup: string | null = null;
    /** Bumped per (re)schedule: a stale schedule resolving late cancels itself. */
    let backupGen = 0;
    let alertedStep: string | null = null;
    let fixMode: FixMode | null = null;
    let unsubscribe: (() => void) | null = null;

    const row = (endReason: EndReason, endedAt: number): TripTrackRow | null =>
      logging && request.tripId
        ? buildTripTrack({
            id: trackId,
            tripId: request.tripId,
            routeSource: route.source,
            startedAt,
            endedAt: Math.max(startedAt, endedAt),
            endReason,
            predictedDurationS: route.durationMin * 60,
            predictedFare: route.costInr,
            rerouteCount: engine.rerouteCount,
            offRouteCount: engine.offRouteCount,
            stepsByVersion,
            history: engine.history,
            // GPS leaves the device only with research consent.
            trackPoints: useResearchConsent.getState().consent ? recorder.points : null,
          })
        : null;

    const persist = () => {
      const snapshot = row('abandoned', lastFix?.t ?? Date.now());
      if (snapshot && userId) void saveActiveTrip(userId, snapshot);
    };

    const publish = () => {
      const step = engine.current ?? null;
      const t = lastFix?.t ?? Date.now();
      const position = lastFix ? { latitude: lastFix.lat, longitude: lastFix.lng } : null;
      const { distanceM: remainingM, arrivalAt } = engine.remaining(t);
      const leg = engine.legRemaining();
      const paths = engine.remainingPolyline();
      const steps = engine.allSteps;
      setView({
        status:
          engine.status === 'idle' ? 'navigating' : (engine.status as NavigationView['status']),
        step,
        steps,
        index: engine.index,
        stepDistanceM: step && position ? distanceM(position, step.endPoint) : null,
        legRemainingM: leg.distanceM,
        legRemainingS: leg.durationS,
        progressM: engine.progressM,
        boarded: engine.boarded,
        remainingM,
        arrivalAt,
        position,
        heading,
        remainingPaths: paths.map((path, i) => ({ step: steps[engine.index + i]!, path })),
        rerouting,
        offRoute: engine.offRoute,
        canReroute: engine.canReroute(Date.now()) && lastFix !== null,
        hasNextLeg: engine.hasNextLeg,
        alert,
        locationDenied,
        simulated: simulate,
      });
    };

    /** Coarse GPS while riding until "get off soon"; best GPS otherwise. */
    const wantedMode = (): FixMode => {
      const step = engine.current;
      return step?.kind === 'transit' && alertedStep !== step.id ? 'saver' : 'precise';
    };
    const watch = () => {
      if (simulate) return;
      const mode = wantedMode();
      if (mode === fixMode) return;
      fixMode = mode;
      unsubscribe?.();
      unsubscribe = locationService.watchFixes(mode, onFix);
    };

    /** Backup "get off" notification at the predicted time (screen off = no GPS). */
    const cancelBackup = () => {
      backupGen += 1;
      cancelAlert(alightBackup);
      alightBackup = null;
    };
    /**
     * On reaching the board stop: from max(scheduled departure, arrival at
     * the stop). Rescheduled on boarding, from the detected boarding time.
     */
    const scheduleBackup = (
      step: NavStep,
      timing: { reachedStopAt: number; boardedAt?: number },
    ) => {
      cancelBackup();
      // A replay runs faster than the timetable: a timed backup would fire at the wrong moment.
      if (simulate) return;
      const at = alightBackupAt(step, { ...timing, now: Date.now() });
      if (at === null || !step.transit) return;
      const gen = backupGen;
      void scheduleAlightBackup(step.transit.alightStop, new Date(at)).then((id) => {
        if (finished || gen !== backupGen) cancelAlert(id);
        else alightBackup = id;
      });
    };

    const reroute = async (from: LatLng) => {
      if (rerouting) return;
      rerouting = true;
      publish();
      try {
        let next: Pick<Route, 'id' | 'legs' | 'source' | 'vehicle'> | null = null;
        if (modeFamily(route) === 'walk') {
          const walk = await directionsService.walking(from, destination.location);
          const durationMin = Math.max(1, Math.round(walk.durationSec / 60));
          next = {
            id: 'walk',
            source: 'google',
            legs: [
              {
                mode: 'walk',
                label: `Walk ${durationMin}m`,
                durationMin,
                distanceKm: Math.round(walk.distanceMeters / 100) / 10,
                polyline: walk.path,
                steps: walk.steps,
              },
            ],
          };
        } else {
          // The existing routing + ranking flow, from where the user is now.
          const vehicles = useRoutlyPrefs.getState().prefs?.vehicles ?? NO_VEHICLES;
          const { routes } = await routingService.getRoutes(from, destination, {
            priority: request.priority,
            vehicles,
          });
          next = pickReroute(route, routes);
        }
        if (finished) return;
        if (!next) throw new Error('No route in the same mode.');
        const steps = routeToSteps(
          { ...next, id: `${next.id}~${stepsByVersion.length}` },
          destination,
        );
        stepsByVersion.push(steps);
        handle(engine.replaceSteps(steps, Date.now()));
      } catch {
        // Still off route: the banner stays, the user can ask again in 30 s.
      } finally {
        rerouting = false;
        publish();
      }
    };

    rerouteRef.current = () => {
      const from = engine.requestReroute(Date.now());
      if (from) void reroute(from);
      else publish();
    };
    nextLegRef.current = () => {
      if (finished) return;
      handle(engine.skipLeg(lastFix?.t ?? Date.now()));
      publish();
    };

    const speak = (event: NavEvent) => {
      if (mutedRef.current) return;
      const text = phraseFor(event, destination.name);
      if (text) say(text);
    };

    function handle(events: NavEvent[]) {
      for (const event of events) {
        speak(event);
        switch (event.type) {
          case 'stepStart':
            alert = null;
            if (event.step.kind === 'transit')
              scheduleBackup(event.step, { reachedStopAt: event.t });
            else cancelBackup();
            persist();
            break;
          case 'boarded':
            if (engine.current) {
              const reachedStopAt = engine.history[engine.history.length - 1]?.startedAt;
              scheduleBackup(engine.current, {
                reachedStopAt: reachedStopAt ?? event.t,
                boardedAt: event.t,
              });
            }
            persist();
            break;
          case 'alightSoon':
            alertedStep = engine.current?.id ?? null;
            alert = { kind: 'alightSoon', stop: event.stop };
            cancelBackup();
            // Vibration + local notification (reaches a pocketed phone).
            void alightAlertNow(event.stop);
            break;
          case 'stopNext':
            alert = { kind: 'stopNext', stop: event.stop };
            break;
          case 'arrived':
            finish('arrived');
            break;
        }
      }
      if (!finished) watch();
    }

    function onFix(fix: Fix) {
      if (finished) return;
      lastFix = fix;
      if (fix.heading !== null && (fix.speed ?? 0) >= HEADING_MIN_SPEED) heading = fix.heading;
      if (logging && recorder.add(fix)) persist();
      handle(engine.update(fix));
      publish();
    }

    let simTimer: ReturnType<typeof setInterval> | null = null;
    function finish(reason: EndReason) {
      if (finished) return;
      finished = true;
      const endedAt = reason === 'arrived' ? (lastFix?.t ?? Date.now()) : Date.now();
      engine.end(endedAt);
      unsubscribe?.();
      if (simTimer) clearInterval(simTimer);
      cancelBackup();
      if (reason !== 'arrived') silence();
      const track = row(reason, endedAt);
      void clearActiveTrip().then(() => {
        if (track) tripLogService.logTripTrack(track);
      });
      publish();
    }
    finishRef.current = finish;

    void prepareAlerts();
    void useResearchConsent.getState().load();
    handle(engine.start(startedAt));

    if (simulate) {
      const plan = simulationPlan(firstSteps, destination.location);
      let simS = 0;
      simTimer = setInterval(() => {
        simS += (simConfig.tickMs / 1000) * simSpeedRef.current;
        onFix(simulatedFix(plan, simS, Date.now()));
      }, simConfig.tickMs);
    } else {
      void locationService.requestPermission().then((permission) => {
        locationDenied = permission === 'denied';
        if (locationDenied) publish();
      });
    }
    publish();

    return () => {
      // Leaving the screen any other way ends the trip.
      finish('user_ended');
    };
    // One session per request.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [request]);

  const end = useCallback(() => finishRef.current('user_ended'), []);
  const reroute = useCallback(() => rerouteRef.current(), []);
  const nextLeg = useCallback(() => nextLegRef.current(), []);
  const toggleMute = useCallback(() => {
    const next = !mutedRef.current;
    mutedRef.current = next;
    if (next) silence();
    setMuted(next);
  }, []);
  const cycleSimSpeed = useCallback(() => {
    const speeds: readonly number[] = simConfig.speeds;
    const next = speeds[(speeds.indexOf(simSpeedRef.current) + 1) % speeds.length] ?? 1;
    simSpeedRef.current = next;
    setSimSpeed(next);
  }, []);

  return { view, muted, toggleMute, end, reroute, nextLeg, simSpeed, cycleSimSpeed };
}
