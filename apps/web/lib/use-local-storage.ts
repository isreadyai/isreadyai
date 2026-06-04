'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

// MARK: - useLocalStorage (SSR-safe, cross-tab; React analog of VueUse's useStorage)

/**
 * Starts from `initialValue` so SSR and the first client render agree — reading
 * localStorage during render would hydration-mismatch. A mount effect hydrates
 * the real value; the setter mirrors writes back, and a 'storage' listener keeps
 * other tabs in sync. Every storage access is guarded (private mode, quota, and
 * SSR all throw), falling back to the in-memory value.
 */

export function useLocalStorage<T>(
  key: string,
  initialValue: T,
): [T, (value: T | ((prev: T) => T)) => void] {
  const [value, setValue] = useState<T>(initialValue)
  // First initialValue only, so the cross-tab listener can reset on key removal
  // without re-subscribing whenever a caller passes a fresh literal each render.
  const initialRef = useRef(initialValue)

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(key)
      if (stored !== null) {
        setValue(JSON.parse(stored) as T)
      }
    } catch {
      // Blocked storage or an unparseable value: keep the in-memory initial value.
    }
  }, [key])

  const set = useCallback(
    (next: T | ((prev: T) => T)): void => {
      setValue((prev) => {
        const resolved = typeof next === 'function' ? (next as (prev: T) => T)(prev) : next
        try {
          window.localStorage.setItem(key, JSON.stringify(resolved))
        } catch {
          // Write failed (quota/blocked): the in-memory value still updates.
        }
        return resolved
      })
    },
    [key],
  )

  useEffect(() => {
    const onStorage = (event: StorageEvent): void => {
      if (event.key !== key) {
        return
      }
      if (event.newValue === null) {
        setValue(initialRef.current)
        return
      }
      try {
        setValue(JSON.parse(event.newValue) as T)
      } catch {
        // A sibling tab wrote an unparseable value: ignore it.
      }
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [key])

  return [value, set]
}
