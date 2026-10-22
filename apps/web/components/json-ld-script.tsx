// MARK: - JSON-LD script

/** Renders one JSON-LD document as an `application/ld+json` script tag. */
export function JsonLdScript({ data }: { data: Record<string, unknown> }) {
  return (
    <script
      type="application/ld+json"
      // eslint-disable-next-line react/no-danger -- static, server-built JSON
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  )
}
