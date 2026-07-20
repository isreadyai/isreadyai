'use client'

import type { DataFastWeb } from 'datafast'

const DATAFAST_WEBSITE_ID = 'dfid_HsawmXCKgvdU04D9NsN2Z'
const DATAFAST_PRODUCTION_HOSTNAMES = new Set(['isready.ai', 'www.isready.ai'])

let datafast: Promise<DataFastWeb | null> | null = null
let datafastClient: DataFastWeb | null = null

function reportDataFastError(error: unknown): void {
  if (process.env.NODE_ENV !== 'production') {
    console.error('[DataFast] analytics failed', error)
  }
}

export function isDataFastEnabledForCurrentHost(): boolean {
  if (typeof window === 'undefined') {
    return false
  }
  return DATAFAST_PRODUCTION_HOSTNAMES.has(window.location.hostname)
}

export function getInitializedDataFast(): Promise<DataFastWeb | null> | null {
  return datafast
}

export function getDataFast(): Promise<DataFastWeb | null> {
  if (!isDataFastEnabledForCurrentHost()) {
    return Promise.resolve(null)
  }

  datafast ??= (async () => {
    try {
      const { initDataFast } = await import('datafast')
      await datafastClient?.optIn()
      datafastClient = await initDataFast({
        websiteId: DATAFAST_WEBSITE_ID,
        autoCapturePageviews: true,
      })
      return datafastClient
    } catch (error: unknown) {
      datafast = null
      reportDataFastError(error)
      return null
    }
  })()

  return datafast
}

export async function startDataFast(): Promise<void> {
  try {
    await getDataFast()
  } catch (error: unknown) {
    reportDataFastError(error)
  }
}

export async function stopDataFast(): Promise<void> {
  try {
    const client = datafastClient ?? (await getInitializedDataFast())
    await client?.optOut()
    datafast = null
  } catch (error: unknown) {
    reportDataFastError(error)
  }
}
