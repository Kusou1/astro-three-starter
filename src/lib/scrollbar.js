import gsap from 'gsap'

// Custom overlay scrollbar — vanilla port of solis4u's. The native root
// scrollbar is hidden in global.scss (cross-platform parity), so this thin fixed
// indicator on the right is the visible scroll affordance: a white thumb inside
// a full-height exclusion-blend track. Maps window scroll (Lenis does REAL
// native scroll, so window.scrollY is accurate) to a thumb offset via GSAP,
// fades in while scrolling, and hides after ~1s idle.
//
// Markup lives in Base.astro as a transition:persist element so it survives
// ClientRouter swaps; initScrollBar() wires the scroll behaviour ONCE
// (idempotent, like initScroll / initTransitions).
let registered = false

export function initScrollBar() {
  if (registered) return
  registered = true

  const track = document.getElementById('scrollbar')
  const bar = document.getElementById('scrollbar-bar')
  if (!track || !bar) return

  let hideTimeout = null
  const onScroll = () => {
    const containerHeight = document.documentElement.clientHeight
    const contentHeight = document.documentElement.scrollHeight
    if (contentHeight <= containerHeight) return

    // Full-height track: thumb height = visible fraction × viewport, travelling
    // the whole track — a standard proportional scrollbar.
    const barHeight = (containerHeight / contentHeight) * containerHeight
    bar.style.height = `${barHeight}px`

    const scroll = window.scrollY || 0
    const offset =
      (scroll / (contentHeight - containerHeight)) *
      (containerHeight - barHeight)
    gsap.to(bar, { y: offset, ease: 'power3.out', overwrite: true, duration: 0.5 })

    if (hideTimeout) clearTimeout(hideTimeout)
    gsap.to(track, { autoAlpha: 1, duration: 0.3, delay: 0.1 })
    hideTimeout = setTimeout(() => {
      gsap.to(track, { autoAlpha: 0, duration: 0.5 })
    }, 1000)
  }

  window.addEventListener('scroll', onScroll, { passive: true })
}
