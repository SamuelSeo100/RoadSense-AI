import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';
import { useEffect } from 'react';
import { create } from 'zustand';

import { supabase } from '@/lib/supabase';
import { unitFor, type FuelType, type UserVehicle, type VehicleType } from '@/services';
import { useAuthStore } from '@/store/authStore';
import { useRoutlyPrefs } from '@/store/routlyPrefsStore';

const KEY = 'routly.vehicles.v1';

interface Stored {
  vehicles: UserVehicle[];
  /** The one-time "Have a car or scooty?" sheet was shown. */
  prompted: boolean;
}

interface VehicleState extends Stored {
  loaded: boolean;
  load: () => Promise<void>;
  /** Insert or replace the vehicle of that type (one car, one scooty). */
  save: (input: VehicleInput) => Promise<void>;
  remove: (type: VehicleType) => Promise<void>;
  markPrompted: () => void;
}

export interface VehicleInput {
  type: VehicleType;
  fuelType: FuelType;
  efficiency: number;
  nickname: string | null;
  priceOverride: number | null;
}

/** user_vehicles row ↔ UserVehicle. */
interface Row {
  id: string;
  type: VehicleType;
  nickname: string | null;
  fuel_type: FuelType;
  efficiency: number | string;
  efficiency_unit: UserVehicle['efficiencyUnit'];
  price_override: number | string | null;
  is_default: boolean;
}

const fromRow = (r: Row): UserVehicle => ({
  id: r.id,
  type: r.type,
  nickname: r.nickname,
  fuelType: r.fuel_type,
  efficiency: Number(r.efficiency),
  efficiencyUnit: r.efficiency_unit,
  priceOverride: r.price_override === null ? null : Number(r.price_override),
  isDefault: r.is_default,
});

const persist = (s: Stored) =>
  AsyncStorage.setItem(KEY, JSON.stringify({ vehicles: s.vehicles, prompted: s.prompted })).catch(
    () => {},
  );

/** Signed in → the server copy is the truth; signed out → the device copy only. */
const signedInUser = () => (supabase ? (useAuthStore.getState().user?.id ?? null) : null);

/**
 * The user's own car / scooty (Profile › My vehicles). Kept on the device (works
 * signed out) and mirrored to Supabase user_vehicles when signed in.
 */
export const useVehicleStore = create<VehicleState>()((set, get) => ({
  vehicles: [],
  prompted: false,
  loaded: false,

  load: async () => {
    try {
      const raw = await AsyncStorage.getItem(KEY);
      if (raw) {
        const s = JSON.parse(raw) as Partial<Stored>;
        set({ vehicles: s.vehicles ?? [], prompted: s.prompted ?? false });
      }
    } catch {
      // Unreadable: start empty.
    }
    set({ loaded: true });
    const userId = signedInUser();
    if (!supabase || !userId) return;
    const { data, error } = await supabase
      .from('user_vehicles')
      .select('id,type,nickname,fuel_type,efficiency,efficiency_unit,price_override,is_default');
    if (error || !data) return; // offline: keep the device copy
    set({ vehicles: (data as Row[]).map(fromRow) });
    void persist(get());
  },

  save: async (input) => {
    const existing = get().vehicles.find((v) => v.type === input.type);
    const vehicle: UserVehicle = {
      id: existing?.id ?? Crypto.randomUUID(),
      type: input.type,
      nickname: input.nickname?.trim() || null,
      fuelType: input.fuelType,
      efficiency: input.efficiency,
      efficiencyUnit: unitFor(input.fuelType),
      priceOverride: input.priceOverride,
      isDefault: true,
    };
    set((s) => ({ vehicles: [...s.vehicles.filter((v) => v.type !== input.type), vehicle] }));
    void persist(get());
    // Having a car / scooty means its routes should show.
    const prefs = useRoutlyPrefs.getState().prefs;
    const toggle = input.type === 'car' ? 'car' : 'bike';
    if (prefs && !prefs.vehicles[toggle]) {
      useRoutlyPrefs.getState().update({ vehicles: { ...prefs.vehicles, [toggle]: true } });
    }
    const userId = signedInUser();
    if (!supabase || !userId) return;
    const { error } = await supabase.from('user_vehicles').upsert(
      {
        id: vehicle.id,
        user_id: userId,
        type: vehicle.type,
        nickname: vehicle.nickname,
        fuel_type: vehicle.fuelType,
        efficiency: vehicle.efficiency,
        efficiency_unit: vehicle.efficiencyUnit,
        price_override: vehicle.priceOverride,
        is_default: true,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,type' },
    );
    if (error) throw new Error(error.message);
  },

  remove: async (type) => {
    set((s) => ({ vehicles: s.vehicles.filter((v) => v.type !== type) }));
    void persist(get());
    const userId = signedInUser();
    if (!supabase || !userId) return;
    const { error } = await supabase
      .from('user_vehicles')
      .delete()
      .eq('user_id', userId)
      .eq('type', type);
    if (error) throw new Error(error.message);
  },

  markPrompted: () => {
    set({ prompted: true });
    void persist(get());
  },
}));

/** Signed-in screens: load (and re-load per account) the saved vehicles. */
export function useLoadVehicles() {
  const userId = useAuthStore((s) => s.user?.id ?? null);
  useEffect(() => {
    void useVehicleStore.getState().load();
  }, [userId]);
}
