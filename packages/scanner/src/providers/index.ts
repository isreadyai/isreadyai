import type { IFetchProvider } from '../types.ts'
import { NativeProvider } from './native.ts'

// MARK: - Providers

export { NativeProvider, SCANNER_UA } from './native.ts'

/** The provider chain the engine consumes — native HTTP only. */
export function createProviders(): IFetchProvider[] {
  return [new NativeProvider()]
}
