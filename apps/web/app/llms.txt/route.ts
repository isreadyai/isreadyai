import { llmsTxt } from '@/lib/llms-content'

// MARK: - /llms.txt

export function GET(): Response {
  return new Response(llmsTxt(), {
    headers: { 'content-type': 'text/plain; charset=utf-8' },
  })
}
