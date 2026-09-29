import { useEffect } from 'react';

import { useAuthStore } from '@/store/authStore';

import { authService } from '../auth.service';

/**
 * Restores the saved session on launch and mirrors every sign-in / sign-out /
 * token refresh into `authStore`. Mount once, in the root layout.
 */
export function useAuthListener() {
  const setUser = useAuthStore((s) => s.setUser);

  useEffect(() => {
    let active = true;
    authService
      .getCurrentUser()
      .then((user) => active && setUser(user))
      .catch(() => active && setUser(null));
    const unsubscribe = authService.onAuthStateChange(setUser);
    return () => {
      active = false;
      unsubscribe();
    };
  }, [setUser]);
}
