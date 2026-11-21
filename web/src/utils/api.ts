/**
 * API Base URL resolution for local development and production.
 * In local development: defaults to '' so Vite proxy handles '/api' -> 'http://localhost:3000'.
 * In production: reads VITE_API_URL (e.g., 'https://hostelconnect-api.onrender.com')
 * or falls back to '' if proxied via Vercel rewrites.
 */
export const API_BASE_URL = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');

/**
 * Normalizes an API path with the configured API base URL.
 * Example: apiUrl('/api/auth/login') -> 'https://hostelconnect-api.onrender.com/api/auth/login'
 */
export function apiUrl(path: string): string {
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  if (!API_BASE_URL) return cleanPath;
  return `${API_BASE_URL}${cleanPath}`;
}

/**
 * Resilient fetch wrapper:
 * 1. Automatically prepends API_BASE_URL if needed.
 * 2. Injects credentials: 'include' for cross-origin cookies.
 * 3. Inspects response body safely (handles empty responses & non-JSON responses).
 * 4. Checks response.ok and produces clear, human-readable error messages.
 */
export async function safeFetchJson<T = any>(
  pathOrUrl: string,
  options: RequestInit = {}
): Promise<{ ok: boolean; status: number; data?: T; error?: string }> {
  try {
    const fullUrl = pathOrUrl.startsWith('http') ? pathOrUrl : apiUrl(pathOrUrl);
    const res = await fetch(fullUrl, {
      ...options,
      credentials: 'include',
    });

    const text = await res.text();
    let json: any = null;
    if (text) {
      try {
        json = JSON.parse(text);
      } catch {
        // Plaintext or HTML response
      }
    }

    if (!res.ok) {
      const errMsg =
        json?.message ||
        json?.error ||
        (text && text.length < 200 ? text : `Server returned HTTP ${res.status}`);
      return { ok: false, status: res.status, error: errMsg, data: json };
    }

    return { ok: true, status: res.status, data: json };
  } catch (err: any) {
    return {
      ok: false,
      status: 0,
      error: err?.message || 'Network error: could not connect to backend server.',
    };
  }
}
