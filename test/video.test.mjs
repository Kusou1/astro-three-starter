import test from 'node:test'
import assert from 'node:assert/strict'
import { playVideoOnce } from '../src/lib/video.js'

class Video extends EventTarget {
  currentTime = 0
  duration = 0.08
  playbackRate = 1
  paused = true
  pause() { this.paused = true }
  play() { this.paused = false; return Promise.resolve() }
}
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

test('fulfilled play without a moving clock is not a started or completed intro', async () => {
  const video = new Video()
  let starts = 0
  const result = await playVideoOnce(video, { startupMs: 20, onStarted: () => starts++ })
  assert.equal(result.reason, 'startup-timeout')
  assert.equal(starts, 0)
  assert.equal(video.paused, true)
})

test('media-time cues fire once and only after the clock advances', async () => {
  const video = new Video()
  const controller = new AbortController()
  let hits = 0
  const run = playVideoOnce(video, { signal: controller.signal, cues: [{ time: 0.03, callback: () => hits++ }] })
  await wait(60)
  assert.equal(hits, 0)
  video.currentTime = 0.04
  await wait(110)
  assert.equal(hits, 1)
  video.currentTime = 0.08
  video.dispatchEvent(new Event('ended'))
  assert.equal((await run).reason, 'ended')
})

test('a duration deadline reports failure rather than completion', async () => {
  const video = new Video()
  const run = playVideoOnce(video, { paddingMs: 5 })
  video.currentTime = 0.04
  assert.equal((await run).reason, 'timeout')
})

test('navigation abort pauses playback and cancels later cues', async () => {
  const video = new Video()
  const controller = new AbortController()
  let hits = 0
  const run = playVideoOnce(video, { signal: controller.signal, cues: [{ time: 0.03, callback: () => hits++ }] })
  controller.abort()
  video.currentTime = 0.05
  await wait(70)
  assert.equal((await run).reason, 'aborted')
  assert.equal(video.paused, true)
  assert.equal(hits, 0)
})

test('autoplay rejection offers a distinct blocked result', async () => {
  const video = new Video()
  video.play = () => Promise.reject(new Error('NotAllowedError'))
  assert.equal((await playVideoOnce(video)).reason, 'blocked')
})
