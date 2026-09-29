import type { AuthError as SupabaseAuthError, SupabaseClient, User } from '@supabase/supabase-js';
import { makeRedirectUri } from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';

import { AuthError, type AuthService, type AuthUser } from '../auth.types';

import { parseOAuthCallback } from './oauthCallback';

const toAuthUser = (user: User): AuthUser => {
  // Email sign-up stores `name`; Google provides `name` and `full_name`.
  const meta = user.user_metadata ?? {};
  const name = [meta.name, meta.full_name].find((v): v is string => typeof v === 'string');
  return { id: user.id, email: user.email ?? null, name: name ?? '' };
};

const ACCOUNT_EXISTS = 'An account with this email already exists. Try logging in.';

/** Supabase error codes → messages we can show users. */
const friendlyMessages: Record<string, string> = {
  invalid_credentials: 'Incorrect email or password.',
  email_not_confirmed: 'Please confirm your email first. Check your inbox for the link.',
  user_already_exists: ACCOUNT_EXISTS,
  email_exists: ACCOUNT_EXISTS,
  over_email_send_rate_limit: 'Too many emails sent. Please wait a few minutes and try again.',
  over_request_rate_limit: 'Too many attempts. Please wait a moment and try again.',
  weak_password: 'Please choose a stronger password.',
  email_address_invalid: 'This email address can’t be used. Please try another.',
  signup_disabled: 'New sign-ups are currently disabled.',
};

/** expo-web-browser error codes (web only). */
const browserMessages: Record<string, string> = {
  ERR_WEB_BROWSER_BLOCKED:
    'Your browser blocked the Google sign-in pop-up. Allow pop-ups and try again.',
  ERR_WEB_BROWSER_CRYPTO: 'Google sign-in needs a secure page (https or localhost).',
};

function toAuthError(error: SupabaseAuthError | Error): AuthError {
  const code = 'code' in error && typeof error.code === 'string' ? error.code : undefined;
  const browser = code ? browserMessages[code] : undefined;
  if (browser) return new AuthError(browser);
  const friendly = code ? friendlyMessages[code] : undefined;
  if (friendly) return new AuthError(friendly);
  if (/network|fetch/i.test(error.message)) {
    return new AuthError('Can’t reach the server. Check your internet connection.');
  }
  return new AuthError(error.message || 'Something went wrong. Please try again.');
}

export function createSupabaseAuthService(supabase: SupabaseClient): AuthService {
  return {
    async getCurrentUser() {
      const { data } = await supabase.auth.getSession();
      return data.session ? toAuthUser(data.session.user) : null;
    },

    onAuthStateChange(listener) {
      const { data } = supabase.auth.onAuthStateChange((_event, session) => {
        listener(session ? toAuthUser(session.user) : null);
      });
      return () => data.subscription.unsubscribe();
    },

    async signInWithEmail(email, password) {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw toAuthError(error);
    },

    async signUp({ email, password, name, phone, preferredModes, priority, city }) {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        // Read by the `handle_new_user` trigger to create the profiles row.
        options: {
          data: { name, phone: phone || null, preferred_modes: preferredModes, priority, city },
        },
      });
      if (error) throw toAuthError(error);
      // With email confirmation on, an existing address returns a user with no
      // identities instead of an error (to avoid leaking which emails exist).
      if (data.user && data.user.identities?.length === 0) {
        throw new AuthError(ACCOUNT_EXISTS);
      }
      return { needsEmailConfirmation: !data.session };
    },

    async signInWithGoogle() {
      // Expo Go: exp://<host>:8081 · dev/standalone build: roadsense:// · web: the page origin.
      // Each must be in Supabase → Authentication → URL Configuration → Redirect URLs.
      const redirectTo = makeRedirectUri({ scheme: 'roadsense' });

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo, skipBrowserRedirect: true },
      });
      if (error) throw toAuthError(error);

      let result: WebBrowser.WebBrowserAuthSessionResult;
      try {
        result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
      } catch (e) {
        throw toAuthError(e instanceof Error ? e : new Error(String(e)));
      }
      // Closed or cancelled by the user: not an error, just no sign-in.
      if (result.type !== 'success') return;

      const callback = parseOAuthCallback(result.url);
      if (callback.error) throw new AuthError(`Google sign-in failed: ${callback.error}`);

      if (callback.code) {
        const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(callback.code);
        if (exchangeError) throw toAuthError(exchangeError);
      } else if (callback.accessToken && callback.refreshToken) {
        // Triggers onAuthStateChange → authStore → the root gate opens the app.
        const { error: sessionError } = await supabase.auth.setSession({
          access_token: callback.accessToken,
          refresh_token: callback.refreshToken,
        });
        if (sessionError) throw toAuthError(sessionError);
      } else {
        throw new AuthError('Google sign-in didn’t return a session. Please try again.');
      }
    },

    async signOut() {
      const { error } = await supabase.auth.signOut();
      if (error) throw toAuthError(error);
    },
  };
}
