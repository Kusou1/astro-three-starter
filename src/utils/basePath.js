// ── Base-path helpers for subdirectory deploys (e.g. demo.example.com/app/) ───
// The site's INTERNAL route model stays base-less ('/', '/about', '/products/…')
// everywhere — route matching, the route bus, ROUTE_COLOR all compare base-less
// paths. The deploy base ('/app') is added ONLY at two boundaries:
//   • withBase()  — when a path goes OUT to the DOM (<a href>) or to Astro's
//                   navigate() (the actual URL the browser/ClientRouter loads).
//   • stripBase() — when a path comes IN from window.location.pathname, so the
//                   internal bus never sees the prefix.
// Vite already rewrites bundled/imported assets (`import … ?url`, _astro/*) with
// the base automatically; these helpers only cover hand-written paths.
//
// import.meta.env.BASE_URL is Astro's `base` config, normalised WITH a trailing
// slash ('/app/', or '/' when no base is set). With no base configured these are
// both no-ops, so it's safe to route everything through them from day one.
const RAW = import.meta.env.BASE_URL || '/'
export const BASE = RAW.replace(/\/$/, '') // '/app'  (''  when base is '/')

/** Prefix an internal absolute path with the deploy base. withBase('/products?cat=x') → '/app/products?cat=x'. */
export function withBase(path = '/') {
  const p = path.startsWith('/') ? path : `/${path}`
  return `${BASE}${p}`
}

/**
 * Drop the deploy base from a live pathname → canonical internal route.
 * Also strips a trailing slash (keeping root '/'): static hosts (Apache
 * DirectorySlash, etc.) 301 a directory request '/app/about' → '/app/about/',
 * so window.location.pathname carries a trailing slash. The internal route model
 * matches base-less, slash-less paths ('/about', startsWith('/products/')), so
 * normalising here keeps route comparisons working regardless of how the host
 * presents the URL.
 */
export function stripBase(pathname = '/') {
  let route = pathname
  if (BASE && (route === BASE || route.startsWith(`${BASE}/`))) {
    route = route.slice(BASE.length) || '/'
  }
  return route.length > 1 ? route.replace(/\/+$/, '') || '/' : route
}
