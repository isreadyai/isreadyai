import type { IScanReport } from '@isreadyai/scanner'
import { generateText } from 'ai'
import { reportToMarkdown } from '@isreadyai/scanner'
import { hostOf } from '@/lib/url'

// MARK: - AI-generated fix plan (AI Gateway)
//
// The premium AI upgrade over the deterministic reportToMarkdown plan: a
// tailored, prioritised remediation plan written through the funded AI Gateway.
// Server-only (reads AI_GATEWAY_API_KEY). Returns null when the gateway isn't
// configured or the call fails, so callers fall back to the mechanical plan.

const FALLBACK_MODEL = 'anthropic/claude-opus-4.8'

export function fixPlanConfigured(): boolean {
  return (process.env.AI_GATEWAY_API_KEY?.length ?? 0) > 0
}

const SYSTEM = `You are isready.ai's AI-readiness remediation planner. Given a website's scan findings, write a concise, prioritised plan a developer can act on now to improve how AI crawlers and agents (GPTBot, ClaudeBot, PerplexityBot, Google) read the site.

Rules:
- Lead with the highest-impact fixes, ordered by impact. For each: what to change, why it matters for AI readers, and concrete steps (file/config/markup), inferring the likely stack from the evidence.
- Be specific and technical and reference the actual findings. No fluff; never restate the score.
- Output GitHub-flavoured Markdown: one intro line, then "## Priority fixes" (numbered), then "## Also worth doing". Keep it under ~400 words.
- Never invent findings that are not in the report.`

/**
 * Turns a scan report into a tailored Markdown remediation plan via the AI
 * Gateway, or null when the gateway is unconfigured or the call fails. The
 * deterministic plan is passed as grounding so the model prioritises real
 * findings instead of inventing them.
 */
export async function generateAiFixPlan(report: IScanReport): Promise<string | null> {
  if (!fixPlanConfigured()) {
    return null
  }
  const host = hostOf(report.finalUrl)
  const findings = reportToMarkdown(report, 'llm').slice(0, 16_000)
  try {
    const { text } = await generateText({
      model: process.env.FIX_PLAN_MODEL ?? FALLBACK_MODEL,
      temperature: 0.2,
      headers: {
        'http-referer': process.env.NEXT_PUBLIC_SITE_URL ?? 'https://isready.ai',
        'x-title': 'isready.ai fix plan',
      },
      system: SYSTEM,
      prompt: `Site: ${host} — overall ${report.overall}/100 (${report.grade}).\n\nScan findings:\n${findings}\n\nWrite the tailored fix plan.`,
    })
    const plan = text.trim()
    return plan.length > 0 ? plan : null
  } catch {
    return null
  }
}
