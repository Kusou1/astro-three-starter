import Lenis from 'lenis'
import gsap from 'gsap'

// ── Global smooth-scroll singleton ──────────────────────────────────────────
// With ClientRouter the DOM is swapped each navigation, so we re-init Lenis per
// page-load. Decision (2026-06-11): Lenis-first for the scaffold; a self-rolled
// scroll can later replace THIS one file without touching anything else.
let lenis = null
let registered = false

function tick(time) {
  lenis?.raf(time * 1000)
}

function start() {
  lenis?.destroy()
  lenis = new Lenis({ autoRaf: false })
  // Drive Lenis off GSAP's ticker → one RAF source for the whole app.
  gsap.ticker.add(tick)
  gsap.ticker.lagSmoothing(0)
}

export function initScroll() {
  if (registered) return
  registered = true
  document.addEventListener('astro:page-load', start)
  // Detach the ticker binding before swap; start() re-adds a fresh one.
  document.addEventListener('astro:before-swap', () => gsap.ticker.remove(tick))
}

export function getLenis() {
  return lenis
}
