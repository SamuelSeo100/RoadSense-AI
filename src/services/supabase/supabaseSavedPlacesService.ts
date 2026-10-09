import type { SupabaseClient } from '@supabase/supabase-js';

import type { Place, SavedPlace, SavedPlacesService } from '../types';

/** ~1 m: what `saved_places` stores (the columns enforce it too). */
const round5 = (n: number) => Math.round(n * 1e5) / 1e5;

interface SavedPlaceRow {
  label: string;
  name: string;
  lat: number | string;
  lng: number | string;
  place_id: string | null;
}

const toSavedPlace = (row: SavedPlaceRow): SavedPlace => ({
  id: row.label.toLowerCase(),
  label: row.label,
  place: {
    id: row.place_id ?? `saved:${row.label.toLowerCase()}`,
    name: row.name,
    location: { latitude: Number(row.lat), longitude: Number(row.lng) },
  },
});

/** `saved_places` for the signed-in user (RLS keeps it to their own rows). */
export function createSupabaseSavedPlacesService(supabase: SupabaseClient): SavedPlacesService {
  const requireSession = async () => {
    const { data } = await supabase.auth.getSession();
    if (!data.session) throw new Error('Not signed in.');
  };

  return {
    async list() {
      await requireSession();
      const { data, error } = await supabase
        .from('saved_places')
        .select('label, name, lat, lng, place_id')
        .order('created_at');
      if (error) throw new Error(error.message);
      return (data as SavedPlaceRow[]).map(toSavedPlace);
    },

    async save(label, place: Place) {
      await requireSession();
      const { error } = await supabase.from('saved_places').upsert(
        {
          label,
          name: place.name.slice(0, 200),
          lat: round5(place.location.latitude),
          lng: round5(place.location.longitude),
          place_id: place.id.startsWith('saved:') ? null : place.id,
        },
        { onConflict: 'user_id,label' },
      );
      if (error) throw new Error(error.message);
    },

    async remove(label) {
      await requireSession();
      const { error } = await supabase.from('saved_places').delete().eq('label', label);
      if (error) throw new Error(error.message);
    },
  };
}
