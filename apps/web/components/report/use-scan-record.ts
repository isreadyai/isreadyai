'use client'

import type { IScanRecord } from '@/lib/scan-record'
import { useCallback, useEffect, useRef, useState } from 'react'
import { EScanStatus, ESmartScanStatus } from '@/lib/scan-record'

interface IScanRecordState {
  record: IScanRecord | null
  missing: boolean
  errored: boolean
  done: boolean
}

const POLL_MS = 1200
const MAX_POLLS = 120
// A handful of consecutive server/network failures before we give up: tolerates a
// transient blip mid-scan, but never polls a genuinely broken endpoint forever.
const MAX_ERRORS = 3

type TPollResult = 'settled' | 'pending' | 'missing' | 'error'

// MARK: - Poll a scan row until it settles

/**
 * Fetches `/api/scan/[id]` on an interval until the base scan and the Smart
 * Agent pass both settle (or the row is missing), then stops. `done` flips once
 * the base report is ready, even while the Smart Agent pass keeps running.
 * A persistent fetch error (or exhausting the poll budget) surfaces as `errored`
 * so the view can render an error state instead of spinning forever.
 */
export function useScanRecord(id: string): IScanRecordState {
  const [record, setRecord] = useState<IScanRecord | null>(null)
  const [missing, setMissing] = useState(false)
  const [errored, setErrored] = useState(false)
  const polls = useRef(0)
  const errors = useRef(0)

  const poll = useCallback(async (): Promise<TPollResult> => {
    let response: Response
    try {
      response = await fetch(`/api/scan/${id}`, { cache: 'no-store' })
    } catch {
      return 'error'
    }
    if (response.status === 404 || response.status === 400) {
      return 'missing'
    }
    if (!response.ok) {
      return 'error'
    }
    const data = (await response.json()) as IScanRecord
    setRecord(data)
    const smartSettled =
      data.smartStatus !== ESmartScanStatus.QUEUED && data.smartStatus !== ESmartScanStatus.RUNNING
    return data.status === EScanStatus.FAILED || (data.status === EScanStatus.DONE && smartSettled)
      ? 'settled'
      : 'pending'
  }, [id])

  useEffect(() => {
    let cancelled = false
    let timer: ReturnType<typeof setTimeout> | undefined

    const tick = async (): Promise<void> => {
      polls.current += 1
      const result = await poll()
      if (cancelled) {
        return
      }
      if (result === 'missing') {
        setMissing(true)
        return
      }
      if (result === 'error') {
        errors.current += 1
        if (errors.current >= MAX_ERRORS) {
          setErrored(true)
          return
        }
      } else {
        errors.current = 0
        if (result === 'settled') {
          return
        }
      }
      if (polls.current >= MAX_POLLS) {
        setErrored(true)
        return
      }
      timer = setTimeout(tick, POLL_MS)
    }
    void tick()

    return () => {
      cancelled = true
      if (timer !== undefined) {
        clearTimeout(timer)
      }
    }
  }, [poll])

  const done = record?.status === EScanStatus.DONE && record.report !== null
  return { record, missing, errored, done }
}
