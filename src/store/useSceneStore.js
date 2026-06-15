import { createStore } from 'zustand/vanilla'

// ── Cross-island state BUS ──────────────────────────────────────────────────
// Astro islands + page `<script>`s are SEPARATE bundles and do NOT share React
// context. But Vite dedupes shared module imports into one chunk, so every
// importer of THIS file gets the SAME store instance at runtime. That is the
// only channel through which the isolated R3F island, the page scripts, and
// GSAP can talk. (Same principle nanostores relies on.)
//
// Rule: always import the store from this exact path. Subscribe imperatively
// (`sceneStore.subscribe`) for 60fps / uniform updates; bind with zustand's
// `useStore(sceneStore, selector)` inside React when you only drive JSX props.
export const sceneStore = createStore((set) => ({
  // current route — kept in sync by lib/transitions.js on every navigation
  route: '/',
  // 0..1 page-transition progress — drive from GSAP during swaps
  transition: 0,

  setRoute: (route) => set({ route }),
  setTransition: (transition) => set({ transition }),
}))
