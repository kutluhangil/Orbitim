/**
 * Vercel Functions return JSON on both success and failure. Reading text first
 * means a proxy, local Vite server or HTML outage page cannot collapse into an
 * opaque `Unexpected token` exception at the point a scientific panel refreshes.
 */
export async function readApiJson<T>(response: Response, endpoint: string): Promise<T> {
  const body = await response.text();
  try {
    return JSON.parse(body) as T;
  } catch {
    const preview = body.trim().slice(0, 220) || 'Empty response body.';
    throw new Error(
      `${endpoint} returned invalid JSON with HTTP ${response.status}. ${preview} ` +
      'Local Vite does not execute Vercel Functions; use Vercel dev or a deployed build for API routes.'
    );
  }
}
