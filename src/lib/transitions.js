import { sceneStore } from '@/store/useSceneStore'
import { stripBase } from '@/utils/basePath'
import { createPageScope } from './pageScope.js'
import { createReveal } from './reveal.js'
import { waitForPreloaded } from '@/utils/waitForPreloaded'

let registered = false
let pageScope

function syncRoute() {
  sceneStore.getState().setRoute(stripBase(window.location.pathname))
}

function runIntro() {
  pageScope?.dispose()
  pageScope = createPageScope()
  const scope = pageScope
  scope.add(waitForPreloaded(() => {
    const targets = [...document.querySelectorAll('[data-reveal]')]
    if (!targets.length) return
    scope.add(createReveal(document.querySelector('main'), targets.map((el) => [el]), {
      immediate: true, duration: 0.6, stagger: 0.06, y: 24,
    }))
  }, { signal: scope.signal }))
}

export function initTransitions() {
  if (registered) return
  registered = true
  document.addEventListener('astro:after-swap', syncRoute)
  document.addEventListener('astro:page-load', () => {
    syncRoute()
    runIntro()
  })
}
