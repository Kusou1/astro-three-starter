// Shared easing curves — JS side.
//
// Mirrors the SCSS `$ease` / `$ease1` / `$ease2` / `$picEase` variables in
// src/styles/_variables.scss so a GSAP tween uses EXACTLY the curve a CSS
// transition would on the same target. GSAP doesn't accept a literal
// `cubic-bezier(...)` string — register a CustomEase by name once at module
// load; later imports just hand back the registered name GSAP resolves at
// tween time.
import { gsap } from 'gsap'
import { CustomEase } from 'gsap/CustomEase'

gsap.registerPlugin(CustomEase)

// Keep the four control points identical to _variables.scss. The 4-arg
// shorthand `'x1, y1, x2, y2'` is the CSS-style cubic-bezier shape.
CustomEase.create('siteEase', '0.25, 0.74, 0.22, 0.99')
CustomEase.create('siteEase1', '0.39, 0.575, 0.565, 1')
CustomEase.create('siteEase2', '0.4, 0, 0.2, 1')
CustomEase.create('sitePicEase', '0.76, 0, 0.24, 1')

// Pass as the `ease:` option:  gsap.to(el, { x: 100, ease: EASE })
export const EASE = 'siteEase'
export const EASE1 = 'siteEase1'
export const EASE2 = 'siteEase2'
export const PIC_EASE = 'sitePicEase'
