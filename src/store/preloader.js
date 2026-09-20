import { createStore } from 'zustand/vanilla'
import { features } from '../config/features.js'

export function createPreloaderStore(enabled = false) {
  return createStore((set) => ({
    enabled,
    phase: enabled ? 'loading' : 'disabled',
    preloaded: false,
    preloaderProgress: 0,
    preloadedAnimated: false,
    setPreloaderProgress: (value) => set((state) => {
      if (!state.enabled || state.phase !== 'loading' || !Number.isFinite(value)) return state
      return { preloaderProgress: Math.max(state.preloaderProgress, Math.min(100, Math.max(0, value))) }
    }),
    setPreloaded: (value) => set((state) => {
      if (!value || !state.enabled || state.phase !== 'loading') return state
      return { preloaded: true, preloaderProgress: 100, phase: 'revealing' }
    }),
    setPreloadedAnimated: (value) => set((state) => {
      if (!value || state.phase !== 'revealing') return state
      return { preloadedAnimated: true, phase: 'ready' }
    }),
  }))
}

export const preloaderStore = createPreloaderStore(features.preloader)

// Completion remains in the store so a newly hydrated page can read it again.
export function waitForReady(store, callback, { signal } = {}) {
  let active = true
  let unsubscribe = () => {}
  const cancel = () => {
    active = false
    unsubscribe()
    signal?.removeEventListener('abort', cancel)
  }
  const check = () => {
    const { phase } = store.getState()
    if (active && (phase === 'disabled' || phase === 'ready')) {
      cancel()
      callback()
    }
  }
  if (signal?.aborted) return cancel
  unsubscribe = store.subscribe(check)
  signal?.addEventListener('abort', cancel, { once: true })
  check()
  return cancel
}
