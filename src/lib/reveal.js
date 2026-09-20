import gsap from 'gsap'
import { createPageScope } from './pageScope.js'

export function createReveal(element, groups, {
  blur = 8, duration = 0.9, stagger = 0.1, delay = 0,
  ease = 'power2.out', start = 'top 85%', once = true,
  intro = false, immediate = false, y = 0,
} = {}) {
  const scope = createPageScope()
  const targets = groups.flat()
  if (!targets.length) return scope.dispose
  let completed = false
  const media = gsap.matchMedia()
  media.add({ mobile: '(max-width: 812px)', reduced: '(prefers-reduced-motion: reduce)', all: 'all' }, (context) => {
    const { mobile, reduced } = context.conditions
    const show = () => gsap.set(targets, { autoAlpha: 1, y: 0, filter: 'none', willChange: 'auto' })
    if (reduced || (once && completed)) {
      show()
      return
    }
    gsap.set(targets, {
      autoAlpha: 0, y: mobile ? 0 : y,
      filter: mobile ? 'none' : `blur(${blur}px)`,
      willChange: mobile ? 'opacity' : 'opacity, filter, transform',
    })
    if (intro) return
    const timeline = gsap.timeline({ paused: !immediate, delay, onComplete: () => {
      completed = true
      show()
    } })
    groups.forEach((group, i) => timeline.to(group, {
      autoAlpha: 1, y: 0, filter: mobile ? 'none' : 'blur(0px)', duration, ease,
    }, i * stagger))
    if (immediate) return
    const match = /^top\s+(\d+(?:\.\d+)?)%$/.exec(start)
    const rootMargin = match ? `0px 0px -${100 - Number(match[1])}% 0px` : '0px'
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          timeline.play()
          if (once) observer.disconnect()
        } else if (!once) timeline.reverse()
      }
    }, { rootMargin })
    observer.observe(element)
    return () => observer.disconnect()
  })
  scope.add(() => media.revert())
  return scope.dispose
}
