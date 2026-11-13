// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { createStorage } from 'unstorage'
import lruCache from 'unstorage/drivers/lru-cache'
import { STORAGE_DO_CACHE } from './cache-de-rotas'

// The production cache of rendered pages has to stay bounded whatever is
// written to it. This mounts the same driver, with the same options object,
// that Nitro mounts from nuxt.config.ts (nitro.storage.cache).

const MIB = 1024 * 1024
const chave = (i: number) => `nitro:routes:_:pagina.${i}.json`
/** A cached page as Nitro stores it. */
const pagina = (i: number) => ({ value: { code: 200, headers: { 'content-type': 'text/html' }, body: `<html>${i}</html>` }, mtime: 1 })

function cacheDeProducao() {
  // Nitro hands the whole mount object to the driver, `driver` key included.
  const driver = lruCache({ ...STORAGE_DO_CACHE })
  return { storage: createStorage({ driver }), lru: driver.getInstance() as { size: number; calculatedSize: number } }
}

describe('production cache of rendered pages', () => {
  it('never holds more than 800 entries, and drops the oldest first', async () => {
    const { storage } = cacheDeProducao()

    for (let i = 0; i < 1000; i++) await storage.setItem(chave(i), pagina(i))

    expect(await storage.getKeys()).toHaveLength(800)
    expect(await storage.hasItem(chave(999))).toBe(true)
    expect(await storage.hasItem(chave(200))).toBe(true)
    expect(await storage.hasItem(chave(199))).toBe(false)
    expect(await storage.getItem(chave(999))).toEqual(pagina(999))
  })

  it('never holds more than 150 MiB, however few entries that is', async () => {
    const { storage, lru } = cacheDeProducao()
    // One 4 MiB string shared by every entry: the cache accounts 4 MiB for
    // each of them, the test allocates it once.
    const bloco = 'x'.repeat(4 * MIB)

    for (let i = 0; i < 60; i++) await storage.setItemRaw(chave(i), bloco)

    expect(lru.calculatedSize).toBeLessThanOrEqual(150 * MIB)
    // 37 entries of 4 MiB (plus their keys) are the most that fit in 150 MiB.
    expect(await storage.getKeys()).toHaveLength(37)
    expect(await storage.hasItem(chave(59))).toBe(true)
    expect(await storage.hasItem(chave(22))).toBe(false)
  })

  it('a page that keeps being read survives a flood of other entries', async () => {
    const { storage } = cacheDeProducao()
    await storage.setItem('nitro:routes:_:pagina-quente.json', pagina(0))

    for (let i = 0; i < 3000; i++) {
      await storage.setItem(chave(i), pagina(i))
      if (i % 100 === 0) await storage.getItem('nitro:routes:_:pagina-quente.json')
    }

    expect(await storage.hasItem('nitro:routes:_:pagina-quente.json')).toBe(true)
    expect(await storage.getKeys()).toHaveLength(800)
  })
})
