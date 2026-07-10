import Lenis from 'lenis'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

gsap.registerPlugin(ScrollTrigger)

// ── Global smooth-scroll singleton ──────────────────────────────────────────
// With ClientRouter the DOM is swapped each navigation, so we re-init Lenis per
// page-load. Decision (2026-06-11): Lenis-first for the scaffold; a self-rolled
// scroll can later replace THIS one file without touching anything else.
let lenis = null
let registered = false
// Scroll-lock reference count: transitions + intro animations (or a Preloader)
// each lock/unlock; count > 0 freezes scroll. Survives ClientRouter navigations
// because it's module-level — Lenis is rebuilt per page, but a freshly-built
// Lenis inherits the current count, so a lock started mid-transition doesn't
// leak on nav.
let lockCount = 0

function applyLock() {
  if (lockCount > 0) lenis?.stop()
  else lenis?.start()
}

function tick(time) {
  lenis?.raf(time * 1000)
}

function start() {
  lenis?.destroy()
  lenis = new Lenis({ autoRaf: false })
  if (typeof window !== 'undefined') window.__lenis = lenis // debug hook: __lenis.scrollTo() from CDP
  // Drive Lenis off GSAP's ticker → one RAF source for the whole app.
  gsap.ticker.add(tick)
  gsap.ticker.lagSmoothing(0)
  // Lenis → ScrollTrigger bridge: ST must recompute pin/scrub positions on every
  // Lenis frame, else pinned/scrubbed sections drift under smooth scroll. No-op
  // until the project actually creates triggers.
  lenis.on('scroll', ScrollTrigger.update)
  // Every load/nav → back to top (scrollRestoration is manual; re-assert both
  // the native position and Lenis's internal position are at 0).
  window.scrollTo(0, 0)
  lenis.scrollTo(0, { immediate: true, force: true })
  applyLock() // new Lenis inherits the current lock state → seamless across a mid-transition swap
}

export function initScroll() {
  if (registered) return
  registered = true
  // Never restore the old scroll position on reload / back-forward → always
  // start from the top.
  if (typeof history !== 'undefined' && 'scrollRestoration' in history) {
    history.scrollRestoration = 'manual'
  }
  document.addEventListener('astro:page-load', start)
  // Detach the ticker binding before swap; start() re-adds a fresh one.
  document.addEventListener('astro:before-swap', () => gsap.ticker.remove(tick))
}

export function getLenis() {
  return lenis
}

// Scroll lock (freeze wheel/touch): call during transitions + intro animations
// (or a Preloader). Reference-counted → two overlapping locks won't unlock each
// other early.
//   ⚠️ Each lockScroll() MUST be paired with exactly one unlockScroll() (guard
//   the caller with a `released` idempotency flag to avoid double-decrementing).
export function lockScroll() {
  lockCount++
  applyLock()
}
export function unlockScroll() {
  if (lockCount > 0) lockCount--
  applyLock()
}
