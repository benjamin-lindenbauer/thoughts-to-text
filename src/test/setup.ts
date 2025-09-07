import '@testing-library/jest-dom/vitest'
import { beforeEach } from 'vitest'
import React from 'react'

// Make React available globally for JSX
global.React = React

// Mock ResizeObserver for Radix UI components
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}))

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {}
  
  return {
    getItem: vi.fn().mockImplementation((key: string) => store[key] || null),
    setItem: vi.fn().mockImplementation((key: string, value: string) => {
      store[key] = value
    }),
    removeItem: vi.fn().mockImplementation((key: string) => {
      delete store[key]
    }),
    clear: vi.fn().mockImplementation(() => {
      store = {}
    }),
  }
})()

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
  writable: true
})

// Make localStorageMock available globally for tests
;(globalThis as any).localStorageMock = localStorageMock

// Mock crypto.randomUUID
Object.defineProperty(global, 'crypto', {
  value: {
    randomUUID: () => 'test-uuid-' + Math.random().toString(36).substr(2, 9),
    getRandomValues: (arr: any) => {
      for (let i = 0; i < arr.length; i++) {
        arr[i] = Math.floor(Math.random() * 256);
      }
      return arr;
    },
    subtle: {
      encrypt: vi.fn().mockResolvedValue(new ArrayBuffer(16)),
      decrypt: vi.fn().mockResolvedValue(new ArrayBuffer(16)),
      generateKey: vi.fn().mockResolvedValue({}),
      importKey: vi.fn().mockResolvedValue({}),
      digest: vi.fn().mockResolvedValue(new ArrayBuffer(32)),
    }
  },
  writable: true,
  configurable: true
})

// Mock navigator.storage
Object.defineProperty(navigator, 'storage', {
  value: {
    estimate: vi.fn().mockResolvedValue({
      usage: 1024 * 1024, // 1MB
      quota: 10 * 1024 * 1024 // 10MB
    })
  }
})

// Mock btoa and atob for encryption tests
global.btoa = (str: string) => Buffer.from(str, 'binary').toString('base64')
global.atob = (str: string) => Buffer.from(str, 'base64').toString('binary')

// Mock URL.createObjectURL and revokeObjectURL
global.URL = {
  createObjectURL: vi.fn(() => 'blob:mock-url'),
  revokeObjectURL: vi.fn(),
} as any

// Mock localforage
vi.mock('localforage', () => {
  const stores = new Map<string, Map<string, any>>()
  
  const createMockInstance = (config?: any) => {
    const storeName = config?.storeName || 'default'
    if (!stores.has(storeName)) {
      stores.set(storeName, new Map())
    }
    const store = stores.get(storeName)!
    
    return {
      setItem: vi.fn((key: string, value: any) => {
        store.set(key, value)
        return Promise.resolve(value)
      }),
      getItem: vi.fn((key: string) => {
        return Promise.resolve(store.get(key) || null)
      }),
      removeItem: vi.fn((key: string) => {
        store.delete(key)
        return Promise.resolve()
      }),
      clear: vi.fn(() => {
        store.clear()
        return Promise.resolve()
      }),
      keys: vi.fn(() => {
        return Promise.resolve(Array.from(store.keys()))
      })
    }
  }

  return {
    default: {
      createInstance: vi.fn(createMockInstance)
    }
  }
})

// Clear all mocks before each test
beforeEach(() => {
  vi.clearAllMocks()
  localStorageMock.clear()
})