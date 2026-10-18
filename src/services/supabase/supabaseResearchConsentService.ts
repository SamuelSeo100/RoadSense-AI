import type { SupabaseClient } from '@supabase/supabase-js';

import type { ResearchConsentService } from '../types';

/** `profiles.research_consent` of the signed-in user (RLS: own row only). */
export function createSupabaseResearchConsentService(
  supabase: SupabaseClient,
): ResearchConsentService {
  const userId = async () => {
    const { data } = await supabase.auth.getSession();
    const id = data.session?.user.id;
    if (!id) throw new Error('Not signed in.');
    return id;
  };
  return {
    async get() {
      const { data, error } = await supabase
        .from('profiles')
        .select('research_consent')
        .eq('id', await userId())
        .single();
      if (error) throw new Error(error.message);
      return data?.research_consent === true;
    },
    async set(consent) {
      const { error } = await supabase
        .from('profiles')
        .update({ research_consent: consent })
        .eq('id', await userId());
      if (error) throw new Error(error.message);
    },
  };
}
