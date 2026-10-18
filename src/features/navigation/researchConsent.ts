import { create } from 'zustand';

import { researchConsentService } from '@/services';

interface ResearchConsentState {
  /** Off until the profile says otherwise (and always off in mock-auth mode). */
  consent: boolean;
  loaded: boolean;
  load: () => Promise<void>;
  /** Optimistic; rolls back and rethrows when the server rejects it. */
  set: (consent: boolean) => Promise<void>;
}

/**
 * `profiles.research_consent`: share GPS tracks of navigated trips (Profile
 * toggle for now; the onboarding consent screen comes later).
 */
export const useResearchConsent = create<ResearchConsentState>()((set, get) => ({
  consent: false,
  loaded: false,
  load: async () => {
    if (!researchConsentService) return;
    try {
      set({ consent: await researchConsentService.get(), loaded: true });
    } catch {
      // Offline: keep what we had (off by default).
    }
  },
  set: async (consent) => {
    const before = get().consent;
    set({ consent });
    try {
      if (!researchConsentService) throw new Error('Not available in this build.');
      await researchConsentService.set(consent);
    } catch (e) {
      set({ consent: before });
      throw e;
    }
  },
}));
