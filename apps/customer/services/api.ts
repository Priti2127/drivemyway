import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';

const BASE_URL: string =
  Constants.expoConfig?.extra?.API_BASE_URL ?? 'https://api.drivemyway.up.railway.app';

interface ApiOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  body?: unknown;
  auth?: boolean;
}

async function getToken(): Promise<string | null> {
  return AsyncStorage.getItem('access_token');
}

/**
 * Centralised API client with auto auth header injection.
 * Throws on non-2xx responses with a readable error message.
 */
export async function api<T>(endpoint: string, opts: ApiOptions = {}): Promise<T> {
  const { method = 'GET', body, auth = true } = opts;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-App-Version': '1.0.0',
  };

  if (auth) {
    const token = await getToken();
    if (token) headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${BASE_URL}${endpoint}`, {
    method,
    headers,
    ...(body ? { body: JSON.stringify(body) } : {}),
  });

  const json = await response.json() as { success: boolean; error?: string; data?: T };

  if (!response.ok || !json.success) {
    throw new Error(json.error ?? `Request failed (${response.status})`);
  }

  return json.data as T;
}

// ─── Convenience wrappers ─────────────────────────────────────────────────────
export const apiGet    = <T>(url: string)               => api<T>(url, { method: 'GET' });
export const apiPost   = <T>(url: string, body: unknown) => api<T>(url, { method: 'POST', body });
export const apiPut    = <T>(url: string, body: unknown) => api<T>(url, { method: 'PUT', body });
export const apiDelete = <T>(url: string)               => api<T>(url, { method: 'DELETE' });
