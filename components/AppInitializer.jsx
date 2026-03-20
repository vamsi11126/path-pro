'use client'

import { useEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'
import { addCapacitorAppListener, exitCapacitorApp } from '@/lib/capacitor/client'

export function AppInitializer() {
  const pathname = usePathname()

  const pathnameRef = useRef(pathname)

  useEffect(() => {
    pathnameRef.current = pathname
  }, [pathname])

  useEffect(() => {
    if (process.env.NODE_ENV !== 'development' || !('serviceWorker' in navigator)) {
      return undefined
    }

    let cancelled = false

    const cleanupServiceWorkers = async () => {
      const registrations = await navigator.serviceWorker.getRegistrations()
      const cacheKeys = 'caches' in window ? await caches.keys() : []

      if (registrations.length === 0 && cacheKeys.length === 0) {
        return
      }

      await Promise.allSettled(registrations.map((registration) => registration.unregister()))

      if ('caches' in window) {
        await Promise.allSettled(cacheKeys.map((cacheKey) => caches.delete(cacheKey)))
      }

      if (!cancelled) {
        window.location.reload()
      }
    }

    cleanupServiceWorkers()

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    let backButtonListener
    let cancelled = false

    const setupListener = async () => {
      const listener = await addCapacitorAppListener('backButton', async () => {
        if (pathnameRef.current === '/' || pathnameRef.current === '/dashboard') {
          await exitCapacitorApp()
        } else {
          window.history.back()
        }
      })

      if (cancelled) {
        listener?.remove?.()
        return
      }

      backButtonListener = listener
    }

    setupListener()

    return () => {
      cancelled = true
      backButtonListener?.remove?.()
    }
  }, [])

  return null
}
