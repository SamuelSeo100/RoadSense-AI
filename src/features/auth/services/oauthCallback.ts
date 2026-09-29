export interface OAuthCallbackParams {
  accessToken: string | null;
  refreshToken: string | null;
  /** PKCE authorization code, if the provider used the code flow. */
  code: string | null;
  error: string | null;
}

/**
 * Reads the Supabase OAuth redirect, e.g.
 * `exp://127.0.0.1:8081#access_token=…&refresh_token=…` (implicit flow) or
 * `roadsense://?code=…` (PKCE). Params can be in the query and/or the fragment.
 */
export function parseOAuthCallback(url: string): OAuthCallbackParams {
  const hashIndex = url.indexOf('#');
  const beforeHash = hashIndex === -1 ? url : url.slice(0, hashIndex);
  const fragment = hashIndex === -1 ? '' : url.slice(hashIndex + 1);
  const queryIndex = beforeHash.indexOf('?');
  const query = queryIndex === -1 ? '' : beforeHash.slice(queryIndex + 1);

  const params = new URLSearchParams(query);
  // Fragment values win: that's where the implicit flow puts the tokens.
  new URLSearchParams(fragment).forEach((value, key) => params.set(key, value));

  return {
    accessToken: params.get('access_token'),
    refreshToken: params.get('refresh_token'),
    code: params.get('code'),
    error: params.get('error_description') ?? params.get('error'),
  };
}
