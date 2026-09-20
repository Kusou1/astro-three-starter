// Only page-owned work belongs here; persistent Canvas/Loading owns its lifetime.
export function createPageScope(events = globalThis.document) {
  const controller = new AbortController()
  const cleanups = new Set()
  const add = (cleanup) => {
    let active = true
    const release = () => {
      if (!active) return
      active = false
      cleanups.delete(release)
      cleanup()
    }
    if (controller.signal.aborted) release()
    else cleanups.add(release)
    return release
  }
  const dispose = () => {
    if (controller.signal.aborted) return
    events?.removeEventListener('astro:before-swap', dispose)
    controller.abort()
    for (const cleanup of [...cleanups].reverse()) {
      try { cleanup() } catch (error) { console.error('[page cleanup]', error) }
    }
  }
  events?.addEventListener('astro:before-swap', dispose, { once: true })
  return { signal: controller.signal, add, dispose }
}
