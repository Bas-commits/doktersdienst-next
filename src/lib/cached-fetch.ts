/**
 * In-memory cache that deduplicates in-flight GET requests and reuses
 * recent responses for a short TTL. Reduces duplicate calls from React
 * Strict Mode double-mount and from multiple components requesting the same URL.
 */

const CACHE_TTL_MS = 2000;

type CacheEntry = {
  data: unknown;
  timestamp: number;
};

const responseCache = new Map<string, CacheEntry>();
const inFlight = new Map<string, Promise<unknown>>();

function pruneCache() {
  const now = Date.now();
  for (const [key, entry] of responseCache.entries()) {
    if (now - entry.timestamp > CACHE_TTL_MS) responseCache.delete(key);
  }
}

/**
 * GET the given URL and parse JSON. Deduplicates in-flight requests for the
 * same URL and returns cached result for repeat calls within CACHE_TTL_MS.
 */
export async function cachedGetJson<T = unknown>(url: string): Promise<T> {
  const cached = responseCache.get(url);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.data as T;
  }

  const existing = inFlight.get(url);
  if (existing) {
    return existing as Promise<T>;
  }

  const promise = fetch(url, { credentials: 'include' })
    .then((res) => res.json())
    .then((data: T) => {
      responseCache.set(url, { data, timestamp: Date.now() });
      inFlight.delete(url);
      pruneCache();
      return data;
    })
    .catch((err) => {
      inFlight.delete(url);
      throw err;
    });

  inFlight.set(url, promise);
  return promise as Promise<T>;
}
