import { llmsFullTxt } from '@/lib/llms-content'

// MARK: - /llms-full.txt

export function GET(): Response {
  return new Response(llmsFullTxt(), {
    headers: { 'content-type': 'text/plain; charset=utf-8' },
  })
}
