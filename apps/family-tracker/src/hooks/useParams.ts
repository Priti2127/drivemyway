/**
 * Minimal hook to extract the share token from the URL path.
 * Expected URL pattern: /t/:token
 *
 * No router library needed — keeps the bundle tiny.
 */
export function useParams(): string | null {
  const parts = window.location.pathname.split('/');
  // /t/abc123 → ['', 't', 'abc123']
  const tIndex = parts.indexOf('t');
  if (tIndex !== -1 && parts[tIndex + 1]) {
    return parts[tIndex + 1];
  }
  return null;
}
