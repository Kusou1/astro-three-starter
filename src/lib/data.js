// ── Data seam ────────────────────────────────────────────────────────────────
// Company hard line (2026-06-11): backends write APIs; the frontend fetches JSON
// and deploys independently. No tpl, ever. This is the ONLY file that knows
// where data comes from — swap the base URL, or drop in a CMS client (Prismic
// for client projects), and nothing else in the app changes.
const API_BASE = import.meta.env.PUBLIC_API_BASE ?? ''

export async function fetchJSON(path, init) {
  const res = await fetch(`${API_BASE}${path}`, init)
  if (!res.ok) throw new Error(`fetch ${path} failed: ${res.status}`)
  return res.json()
}
