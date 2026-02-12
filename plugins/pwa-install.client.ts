/**
 * PWA Install Plugin
 * Registers the pwa-install web component for app installation prompts
 */
import '@khmyznikov/pwa-install'

export default defineNuxtPlugin(() => {
  // Web component is automatically registered when imported
  // Works on both Android (native prompt) and iOS (instruction modal)
})
