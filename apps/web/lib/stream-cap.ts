// MARK: - Capped request-body draining

/** Thrown by {@link drainCapped} when a body exceeds its byte cap. */
export class PayloadTooLargeError extends Error {}

/**
 * Drains a byte stream into one buffer, aborting once the running total exceeds
 * `maxBytes`. Caps the bytes actually read, so a missing/spoofed Content-Length
 * can't push unbounded data past the body cap. On overflow the source is
 * cancelled (stops the producer) before {@link PayloadTooLargeError} is thrown.
 */
export async function drainCapped(
  stream: ReadableStream<Uint8Array>,
  maxBytes: number,
): Promise<Uint8Array<ArrayBuffer>> {
  const reader = stream.getReader()
  const chunks: Uint8Array[] = []
  let total = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) {
      break
    }
    total += value.byteLength
    if (total > maxBytes) {
      void reader.cancel().catch(() => undefined)
      throw new PayloadTooLargeError()
    }
    chunks.push(value)
  }

  const merged = new Uint8Array(total)
  let offset = 0
  for (const chunk of chunks) {
    merged.set(chunk, offset)
    offset += chunk.byteLength
  }
  return merged
}
