// Ceilings of the Nitro `cache` storage in production (nuxt.config.ts,
// nitro.storage.cache).
//
// The swr route rules keep the rendered HTML of each page in that storage, one
// entry per distinct URL of the page. In production the storage is an
// in-memory LRU (the driver of unstorage) with a ceiling of entries and a
// ceiling of bytes: once one of them is reached, the least recently used
// entries are dropped. A dropped page is simply rendered again on its next
// request.
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
