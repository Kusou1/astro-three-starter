// Select once before playback; resizing must not restart an active intro.
export function selectVideoSource(video, { desktop, mobile, poster, mobilePoster }, {
  mobileQuery = '(max-width: 812px)',
} = {}) {
  const small = window.matchMedia(mobileQuery).matches
  const source = small && mobile ? mobile : desktop
  if (!source) throw new Error('A desktop video source is required')
  video.poster = (small && mobilePoster ? mobilePoster : poster) || ''
  if (video.getAttribute('src') !== source) {
    video.src = source
    video.load()
  }
  return source
}

// One owner per video. A timeout is a failure result, never a completed intro.
export function playVideoOnce(video, {
  signal, cues = [], onStarted, startupMs = 10000, paddingMs = 1500,
} = {}) {
  return new Promise((resolve) => {
    let settled = false
    let started = false
    let frame
    let deadline
    let poll
    const fired = new Set()
    const events = []
    const initialTime = video.currentTime
    const listen = (target, name, callback) => {
      target?.addEventListener(name, callback)
      events.push(() => target?.removeEventListener(name, callback))
    }
    const finish = (reason) => {
      if (settled) return
      settled = true
      clearTimeout(deadline)
      clearInterval(poll)
      if (frame !== undefined) video.cancelVideoFrameCallback?.(frame)
      events.forEach((cleanup) => cleanup())
      video.pause()
      resolve({ reason, currentTime: video.currentTime })
    }
    const armDeadline = () => {
      if (!started || settled) return
      clearTimeout(deadline)
      if (Number.isFinite(video.duration) && video.duration > 0) {
        const remaining = Math.max(0, video.duration - video.currentTime)
        deadline = setTimeout(() => finish('timeout'), remaining / Math.max(video.playbackRate, 0.01) * 1000 + paddingMs)
      } else {
        deadline = setTimeout(() => finish('timeout'), startupMs)
      }
    }
    const check = () => {
      if (settled) return
      if (!started && !video.paused && video.currentTime > initialTime + 0.02) {
        started = true
        armDeadline()
        onStarted?.()
      }
      if (!started || settled || video.paused) return
      cues.forEach((cue, index) => {
        if (settled || fired.has(index) || video.currentTime < cue.time) return
        fired.add(index)
        cue.callback(video.currentTime)
      })
    }
    const nextFrame = () => {
      check()
      if (!settled) frame = video.requestVideoFrameCallback(nextFrame)
    }
    const requestPlay = () => {
      if (settled) return
      try {
        video.play()?.catch(() => {
          if (!started) finish('blocked')
        })
      } catch {
        finish('blocked')
      }
    }
    if (signal?.aborted) {
      finish('aborted')
      return
    }
    video.muted = true
    video.playsInline = true
    video.loop = false
    listen(signal, 'abort', () => finish('aborted'))
    listen(video, 'error', () => finish('error'))
    listen(video, 'ended', () => {
      check()
      finish(started ? 'ended' : 'error')
    })
    listen(video, 'durationchange', armDeadline)
    listen(video, 'ratechange', armDeadline)
    // Some embedded browsers allow playback after their bridge becomes ready.
    listen(globalThis.document, 'WeixinJSBridgeReady', requestPlay)
    deadline = setTimeout(() => finish('startup-timeout'), startupMs)
    // Poll also covers browsers without frame callbacks and a stalled media clock.
    poll = setInterval(check, 50)
    if (video.requestVideoFrameCallback) frame = video.requestVideoFrameCallback(nextFrame)
    requestPlay()
  })
}
