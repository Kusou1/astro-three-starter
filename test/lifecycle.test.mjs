import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createPageScope } from '../src/lib/pageScope.js'
import { createPreloaderStore, waitForReady } from '../src/store/preloader.js'

test('zero progress still blocks an enabled loader until the outro completes', () => {
  const store = createPreloaderStore(true)
  let calls = 0
  waitForReady(store, () => calls++)
  assert.equal(calls, 0)
  store.getState().setPreloaded(true)
  assert.equal(calls, 0)
  store.getState().setPreloadedAnimated(true)
  assert.equal(calls, 1)
  store.getState().setPreloadedAnimated(true)
  assert.equal(calls, 1)
  waitForReady(store, () => calls++)
  assert.equal(calls, 2)
})

test('disabled loading resolves immediately; cancellation never calls a stale page', () => {
  let calls = 0
  waitForReady(createPreloaderStore(), () => calls++)
  assert.equal(calls, 1)
  const store = createPreloaderStore(true)
  const events = new EventTarget()
  const scope = createPageScope(events)
  waitForReady(store, () => calls++, { signal: scope.signal })
  const cancel = waitForReady(store, () => calls++)
  cancel()
  events.dispatchEvent(new Event('astro:before-swap'))
  waitForReady(createPreloaderStore(), () => calls++, { signal: scope.signal })
  store.getState().setPreloaded(true)
  store.getState().setPreloadedAnimated(true)
  assert.equal(calls, 1)
})

test('progress is finite, clamped and monotonic; completion is not reset by remounts', () => {
  const store = createPreloaderStore(true)
  const actions = store.getState()
  for (const value of [70, 30, NaN, -10]) actions.setPreloaderProgress(value)
  assert.equal(store.getState().preloaderProgress, 70)
  actions.setPreloaderProgress(120)
  assert.equal(store.getState().preloaderProgress, 100)
  actions.setPreloadedAnimated(true)
  assert.equal(store.getState().phase, 'loading')
  actions.setPreloaded(true)
  actions.setPreloadedAnimated(true)
  actions.setPreloaded(false)
  actions.setPreloaderProgress(0)
  assert.equal(store.getState().phase, 'ready')
  assert.equal(store.getState().preloaderProgress, 100)
})

test('page scope cancels every owned resource once and immediately disposes late work', () => {
  const events = new EventTarget()
  const scope = createPageScope(events)
  const calls = []
  const release = scope.add(() => calls.push('subscription'))
  release()
  scope.add(() => calls.push('timeline'))
  scope.add(() => calls.push('observer'))
  events.dispatchEvent(new Event('astro:before-swap'))
  scope.dispose()
  release()
  scope.add(() => calls.push('late'))
  assert.deepEqual(calls, ['subscription', 'observer', 'timeline', 'late'])
  assert.equal(scope.signal.aborted, true)
  const next = createPageScope(events)
  assert.equal(next.signal.aborted, false)
  next.dispose()
})
