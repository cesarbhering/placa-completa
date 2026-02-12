/**
 * Vitest Global Setup
 *
 * Configures test environment, mocks, and global utilities
 */

import { vi } from 'vitest'

// Mock window.gtag for analytics
global.window = global.window || {}
global.window.gtag = vi.fn()

// Mock window.OneSignalDeferred for push notifications
global.window.OneSignalDeferred = []

// Mock $fetch for Nuxt
global.$fetch = vi.fn()

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {}

  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value.toString()
    },
    removeItem: (key: string) => {
      delete store[key]
    },
    clear: () => {
      store = {}
    },
  }
})()

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
})

// Mock Notification API
Object.defineProperty(window, 'Notification', {
  value: {
    permission: 'default',
    requestPermission: vi.fn().mockResolvedValue('granted'),
  },
  writable: true,
})
