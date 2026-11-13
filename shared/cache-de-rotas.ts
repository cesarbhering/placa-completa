// Ceilings of the Nitro `cache` storage in production (nuxt.config.ts,
// nitro.storage.cache).
//
// The swr route rules keep the rendered HTML of each page in that storage. On
// the node-server preset its default is the memory of the process, with no
// limit and no eviction, and Nitro keys each entry by the full URL, query
// string included. So every distinct URL of a cached page (an ad click id, a
// tracking parameter) was one more copy that never left, and the memory of the
// process could only grow.
//
// The LRU driver of unstorage keeps the cache in memory, as before, and drops
// the least recently used entries once a ceiling is reached. A dropped page is
// simply rendered again on its next request.
//
// Why these numbers (measured on Nov 13, 2026, on a local production build):
// - A cached page is 75 to 115 KB of HTML, and its entry is about that size.
// - The swr rules cover about 380 real pages (the sitemap list).
// - 800 entries is twice the real pages: all of them fit, with room left for
//   the query-string variants that normal traffic brings. Full of typical
//   pages, the cache counts 60 to 70 MB.
// - 150 MiB is the hard stop in case pages get bigger. It counts the UTF-8
//   bytes of the stored entries. In the heap of the process a string takes
//   close to two bytes per character (800 entries counted as 61 MB held about
//   115 MB), so the worst case in memory is about 290 MB.

export const CACHE_MAX_ENTRADAS = 800
export const CACHE_MAX_BYTES = 150 * 1024 * 1024

/**
 * Mount of the Nitro `cache` storage in production. Development and prerender
 * keep Nitro's own mount (files under the build directory).
 */
export const STORAGE_DO_CACHE = {
  driver: 'lruCache',
  max: CACHE_MAX_ENTRADAS,
  maxSize: CACHE_MAX_BYTES,
} as const
