import Constants from 'expo-constants';
import { Platform } from 'react-native';

import { serviceConfig } from '../config';

/**
 * Identifies the app to Google, so the key can be restricted to Routly's
 * Android package + signing cert / iOS bundle ID.
 */
function platformHeaders(): Record<string, string> {
  const config = Constants.expoConfig;
  if (Platform.OS === 'ios' && config?.ios?.bundleIdentifier) {
    return { 'X-Ios-Bundle-Identifier': config.ios.bundleIdentifier };
  }
  if (Platform.OS === 'android' && config?.android?.package) {
    const cert = serviceConfig.androidCertSha1.replace(/:/g, '');
    return {
      'X-Android-Package': config.android.package,
      ...(cert ? { 'X-Android-Cert': cert } : {}),
    };
  }
  return {};
}

const headers = {
  'Content-Type': 'application/json',
  'X-Goog-Api-Key': serviceConfig.googleMapsApiKey,
  ...platformHeaders(),
};

export class GoogleApiError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GoogleApiError';
  }
}

interface GoogleRequest {
  method?: 'GET' | 'POST';
  body?: unknown;
  /** Only these fields are returned (smaller, cheaper responses). */
  fieldMask: string;
  signal?: AbortSignal;
}

/** JSON request to a Google Maps Platform REST API. */
export async function googleRequest<T>(
  url: string,
  { method = 'POST', body, fieldMask, signal }: GoogleRequest,
): Promise<T> {
  const res = await fetch(url, {
    method,
    signal,
    headers: { ...headers, 'X-Goog-FieldMask': fieldMask },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const json: unknown = await res.json().catch(() => null);
  if (!res.ok) {
    const message =
      typeof json === 'object' && json !== null && 'error' in json
        ? String((json as { error?: { message?: string } }).error?.message ?? '')
        : '';
    throw new GoogleApiError(message || `Google API request failed (${res.status})`);
  }
  return json as T;
}
