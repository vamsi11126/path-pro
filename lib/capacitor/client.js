let capacitorCorePromise
let capacitorAppPromise
let capacitorBrowserPromise
let nativeSpeechPromise

const isBrowser = () => typeof window !== 'undefined'

async function loadCapacitorCore() {
  if (!isBrowser()) {
    return null
  }

  capacitorCorePromise ||= import('@capacitor/core')
  return capacitorCorePromise
}

async function loadCapacitorApp() {
  if (!isBrowser()) {
    return null
  }

  capacitorAppPromise ||= import('@capacitor/app')
  return capacitorAppPromise
}

async function loadCapacitorBrowser() {
  if (!isBrowser()) {
    return null
  }

  capacitorBrowserPromise ||= import('@capacitor/browser')
  return capacitorBrowserPromise
}

export async function getCapacitorPlatform() {
  const capacitorModule = await loadCapacitorCore()
  return capacitorModule?.Capacitor?.getPlatform?.() || 'web'
}

export async function isCapacitorNativePlatform() {
  const capacitorModule = await loadCapacitorCore()
  return Boolean(capacitorModule?.Capacitor?.isNativePlatform?.())
}

export async function addCapacitorAppListener(eventName, listener) {
  const capacitorAppModule = await loadCapacitorApp()
  return capacitorAppModule?.App?.addListener?.(eventName, listener) || null
}

export async function exitCapacitorApp() {
  const capacitorAppModule = await loadCapacitorApp()
  return capacitorAppModule?.App?.exitApp?.()
}

export async function openCapacitorBrowser(options) {
  const capacitorBrowserModule = await loadCapacitorBrowser()
  return capacitorBrowserModule?.Browser?.open?.(options)
}

export async function closeCapacitorBrowser() {
  const capacitorBrowserModule = await loadCapacitorBrowser()
  return capacitorBrowserModule?.Browser?.close?.()
}

export async function getNativeSpeechRecognition() {
  if (!isBrowser()) {
    return null
  }

  nativeSpeechPromise ||= import('@capacitor-community/speech-recognition')
  const nativeSpeechModule = await nativeSpeechPromise
  return nativeSpeechModule?.SpeechRecognition || null
}
