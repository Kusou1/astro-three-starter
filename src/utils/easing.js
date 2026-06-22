// Cubic-bezier easing factory — same math as the browser's CSS cubic-bezier().
//
// For consumers that need a numeric easing function `(t: number) => number`
// rather than a name string — chiefly Lenis `scrollTo({ easing })`. Pair with
// the SCSS/GSAP control points in _variables.scss / ease.js to keep one curve
// across CSS, GSAP and scroll, e.g.:
//
//   import { cubicBezier } from '@/utils/easing'
//   const ease = cubicBezier(0.25, 0.74, 0.22, 0.99) // === $ease / EASE
//   lenis.scrollTo(target, { duration: 1.2, easing: ease })
export function cubicBezier(p1x, p1y, p2x, p2y) {
    const cx = 3 * p1x
    const bx = 3 * (p2x - p1x) - cx
    const ax = 1 - cx - bx
    const cy = 3 * p1y
    const by = 3 * (p2y - p1y) - cy
    const ay = 1 - cy - by

    const sampleX = (t) => ((ax * t + bx) * t + cx) * t
    const sampleY = (t) => ((ay * t + by) * t + cy) * t
    const sampleDX = (t) => (3 * ax * t + 2 * bx) * t + cx

    const solveX = (x) => {
        // Newton-Raphson first (fast for monotonic curves)
        let t = x
        for (let i = 0; i < 8; i++) {
            const dx = sampleX(t) - x
            if (Math.abs(dx) < 1e-6) return t
            const d = sampleDX(t)
            if (Math.abs(d) < 1e-6) break
            t -= dx / d
        }
        // Bisection fallback
        let lo = 0, hi = 1
        t = x
        while (lo < hi) {
            const x2 = sampleX(t)
            if (Math.abs(x2 - x) < 1e-6) return t
            if (x > x2) lo = t; else hi = t
            t = (hi - lo) * 0.5 + lo
        }
        return t
    }

    return (x) => sampleY(solveX(x))
}
