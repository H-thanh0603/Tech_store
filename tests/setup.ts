import '@testing-library/jest-dom/vitest'

import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

// jsdom implements no media queries, but components that respect
// `prefers-reduced-motion` legitimately call matchMedia during mount. The stub
// reports "no preference" and supports both the modern and legacy listener APIs,
// so reduced-motion branches stay testable by overriding `matches` per test.
if (typeof window !== 'undefined' && typeof window.matchMedia !== 'function') {
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  })) as typeof window.matchMedia
}

// Reveal-on-scroll components observe their own element. jsdom has no
// IntersectionObserver, so the stub reports every observed element as visible
// immediately: tests assert on the revealed state, which is also the state a
// reduced-motion or no-JS visitor gets.
if (typeof window !== 'undefined' && typeof window.IntersectionObserver !== 'function') {
  class StubIntersectionObserver implements IntersectionObserver {
    readonly root = null
    readonly rootMargin = ''
    readonly thresholds: ReadonlyArray<number> = []

    constructor(private readonly callback: IntersectionObserverCallback) {}

    observe(target: Element) {
      this.callback(
        [{ isIntersecting: true, target } as IntersectionObserverEntry],
        this as unknown as IntersectionObserver,
      )
    }

    unobserve() {}
    disconnect() {}
    takeRecords(): IntersectionObserverEntry[] {
      return []
    }
  }

  window.IntersectionObserver = StubIntersectionObserver as unknown as typeof IntersectionObserver
  globalThis.IntersectionObserver = window.IntersectionObserver
}

// Node 26 exposes a global localStorage that throws unless --localstorage-file
// is set, and jsdom 29 leaves window.localStorage undefined in that case. The
// in-memory stub keeps storage tests runnable without Node flags.
if (typeof window !== 'undefined' && typeof window.localStorage === 'undefined') {
  const store = new Map<string, string>()
  const localStorageStub = {
    getItem: (key: string) => (store.has(key) ? store.get(key)! : null),
    setItem: (key: string, value: string) => {
      store.set(key, String(value))
    },
    removeItem: (key: string) => {
      store.delete(key)
    },
    clear: () => {
      store.clear()
    },
    key: (index: number) => Array.from(store.keys())[index] ?? null,
    get length() {
      return store.size
    },
  } as Storage
  Object.defineProperty(window, 'localStorage', { value: localStorageStub, configurable: true })
  Object.defineProperty(globalThis, 'localStorage', { value: localStorageStub, configurable: true })
}

// Vitest does not auto-unmount RTL renders between tests, so without this the
// jsdom document accumulates every render and role queries match across tests.
afterEach(() => {
  cleanup()
})
