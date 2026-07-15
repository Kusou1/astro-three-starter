import gsap from 'gsap'
import { sceneStore } from '@/store/useSceneStore'
import { stripBase } from '@/utils/basePath'

// ── ClientRouter navigation lifecycle ───────────────────────────────────────
// The hard, manual part of Astro + R3F. Registered ONCE (idempotent); the
// listeners fire on every navigation. The persistent canvas island is NOT
// touched here — only the swapped DOM and its GSAP animations.
let registered = false

function syncRoute() {
  // Tell the bus which route is live → SceneSwitcher reacts. stripBase so the
  // internal route model stays base-less on subdirectory deploys.
  sceneStore.getState().setRoute(stripBase(window.location.pathname))
}

function runIntro() {
  // Per-page reveal on the freshly-swapped DOM. Re-runs every navigation.
  const targets = document.querySelectorAll('[data-reveal]')
  if (!targets.length) return
  gsap.fromTo(
    targets,
    { autoAlpha: 0, y: 24, filter: 'blur(8px)' },
    {
      autoAlpha: 1,
      y: 0,
      filter: 'blur(0px)',
      duration: 0.6,
      ease: 'power2.out',
      stagger: 0.06,
    },
  )
}

function teardown() {
  // Kill tweens bound to the OUTGOING DOM before it's swapped away, or you leak
  // animations pointing at detached nodes. Coarse for v0 — scope per-section in
  // real projects. When you add ScrollTrigger:
  //   ScrollTrigger.getAll().forEach((t) => t.kill())
  gsap.globalTimeline.clear()
}

export function initTransitions() {
  if (registered) return
  registered = true

  // Fires on initial load AND after every ClientRouter swap (new DOM in place).
  document.addEventListener('astro:page-load', () => {
    syncRoute()
    runIntro()
  })

  // Fires before the old DOM is swapped out — clean up here.
  document.addEventListener('astro:before-swap', teardown)
}
