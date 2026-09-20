import { preloaderStore, waitForReady } from '../store/preloader.js'

export function waitForPreloaded(callback, options) {
  return waitForReady(preloaderStore, callback, options)
}
