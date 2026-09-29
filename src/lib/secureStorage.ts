import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

/**
 * Key-value storage for the Supabase session.
 *
 * Native: expo-secure-store (Keychain / Keystore). SecureStore values should stay
 * under 2048 bytes and a session is often larger, so values are split into
 * chunks: `key` holds the chunk count, `key.0`, `key.1`… hold the data.
 * Web: localStorage (SecureStore isn't available there).
 */
const CHUNK_SIZE = 1800;

const chunkKey = (key: string, i: number) => `${key}.${i}`;

const nativeStorage = {
  async getItem(key: string): Promise<string | null> {
    const count = Number(await SecureStore.getItemAsync(key));
    if (!count) return null;
    const chunks = await Promise.all(
      Array.from({ length: count }, (_, i) => SecureStore.getItemAsync(chunkKey(key, i))),
    );
    return chunks.some((c) => c === null) ? null : chunks.join('');
  },

  async setItem(key: string, value: string): Promise<void> {
    await nativeStorage.removeItem(key);
    const chunks = value.match(new RegExp(`[\\s\\S]{1,${CHUNK_SIZE}}`, 'g')) ?? [''];
    await Promise.all(chunks.map((c, i) => SecureStore.setItemAsync(chunkKey(key, i), c)));
    await SecureStore.setItemAsync(key, String(chunks.length));
  },

  async removeItem(key: string): Promise<void> {
    const count = Number(await SecureStore.getItemAsync(key));
    await Promise.all(
      Array.from({ length: count || 0 }, (_, i) => SecureStore.deleteItemAsync(chunkKey(key, i))),
    );
    await SecureStore.deleteItemAsync(key);
  },
};

const webStorage = {
  async getItem(key: string) {
    return typeof localStorage === 'undefined' ? null : localStorage.getItem(key);
  },
  async setItem(key: string, value: string) {
    if (typeof localStorage !== 'undefined') localStorage.setItem(key, value);
  },
  async removeItem(key: string) {
    if (typeof localStorage !== 'undefined') localStorage.removeItem(key);
  },
};

export const secureStorage = Platform.OS === 'web' ? webStorage : nativeStorage;
