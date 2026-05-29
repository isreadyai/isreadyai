/**
 * Smart Agent signal analysis: observation assessment and site aggregation.
 */

import type {
  ISmartAgentCategoryScore,
  ISmartAgentObservation,
  ISmartAgentReport,
  ISmartAgentSignal,
  ISmartAgentSiteReport,
  TSmartAgentStatus,
} from './types.ts'
import {
  ESmartAgentCategory,
  ESmartAgentStatus,
  SMART_AGENT_CATEGORY_LABELS,
  SMART_AGENT_CATEGORY_WEIGHTS,
} from './types.ts'
import { gradeOf } from '../score.ts'

// MARK: - Constants

const SCORE_VERSION = '2026.06-smart.1'
const INTERACTIVE_ROLES = new Set([
  'button',
  'checkbox',
  'combobox',
  'link',
  'menuitem',
  'option',
  'radio',
  'searchbox',
  'slider',
  'spinbutton',
  'switch',
  'tab',
  'textbox',
])
const LANDMARK_PATTERN = /\b(banner|contentinfo|form|main|navigation|region|search)\b/gi
const CONTENT_PATTERN =
  /\b(article|blockquote|cell|definition|document|heading|list|listitem|paragraph|row)\b/gi
const BARRIER_PATTERN =
  /\b(access denied|captcha|challenge|checking your browser|enable javascript|forbidden|just a moment|not authorized|robot verification|security check)\b/gi

type TSignalInput = Omit<ISmartAgentSignal, 'status' | 'weight'> &
  Partial<Pick<ISmartAgentSignal, 'weight'>>

// MARK: - Public API

/**
 * Analyzes a Smart Agent observation, generating signals and scoring across categories.
 *
 * @param {ISmartAgentObservation} observation - Browser observation with snapshot and element references.
 * @param {string} provider - Name of the provider (e.g. agent-browser).
 * @param {Date} [startedAt=new Date()] - Start timestamp for duration calculation.
 * @param {string | null} [agentBrowserVersion=null] - Version of the agent-browser tool.
 * @returns {ISmartAgentReport} - Complete assessment with signals, categories, and metadata.
 * @export
 */
export function analyzeSmartAgentObservation(
  observation: ISmartAgentObservation,
  provider: string,
  startedAt = new Date(),
  agentBrowserVersion: string | null = null,
): ISmartAgentReport {
  const snapshot = cleanSnapshot(observation.snapshot)
  const refs = Object.values(observation.refs)
  const namedRefs = refs.filter((ref) => ref.name.trim().length > 0)
  const interactiveRefs = refs.filter((ref) => INTERACTIVE_ROLES.has(ref.role.toLowerCase()))
  const namedInteractiveRefs = interactiveRefs.filter((ref) => ref.name.trim().length > 0)
  const links = refs.filter((ref) => ref.role.toLowerCase() === 'link')
  const namedLinks = links.filter((ref) => ref.name.trim().length > 0)
  const images = refs.filter((ref) => {
    const role = ref.role.toLowerCase()
    return role === 'image' || role === 'img'
  })
  const namedImages = images.filter((ref) => ref.name.trim().length > 0)
  const headingLevels = Array.from(snapshot.matchAll(/\bheading\b[^\n]*\blevel=(\d)/gi)).map(
    (match) => Number(match[1]),
  )
  const headingCount = countMatches(snapshot, /\bheading\b/gi)
  const landmarkCount = countMatches(snapshot, LANDMARK_PATTERN)
  const contentNodeCount = countMatches(snapshot, CONTENT_PATTERN)
  const barrierMatches = uniqueMatches(snapshot, BARRIER_PATTERN)
  const meaningfulCharacters = snapshot.replace(/[-\s()[\]{}"'`=:,@]/g, '').length

  const signals: ISmartAgentSignal[] = [
    signal({
      id: 'smart-visible-content',
      category: ESmartAgentCategory.VISIBLE_CONTENT,
      score: thresholdScore(meaningfulCharacters, 1200, 300),
      title: 'Rendered content is visible',
      detail:
        meaningfulCharacters >= 1200
          ? `The browser snapshot exposes ${meaningfulCharacters} meaningful characters.`
          : `The browser snapshot exposes only ${meaningfulCharacters} meaningful characters.`,
      evidence: { meaningfulCharacters },
      fix:
        meaningfulCharacters < 1200
          ? 'Render the primary page content as semantic HTML and avoid hiding it behind interaction-only states.'
          : undefined,
    }),
    signal({
      id: 'smart-content-nodes',
      category: ESmartAgentCategory.VISIBLE_CONTENT,
      score: thresholdScore(contentNodeCount, 12, 4),
      title: 'Content has readable nodes',
      detail: `The accessibility tree exposes ${contentNodeCount} content nodes.`,
      evidence: { contentNodeCount },
      fix:
        contentNodeCount < 12
          ? 'Use headings, paragraphs, lists and articles so an agent receives structured content instead of a shallow shell.'
          : undefined,
    }),
    signal({
      id: 'smart-images',
      category: ESmartAgentCategory.VISIBLE_CONTENT,
      score: ratioScore(namedImages.length, images.length),
      weight: 0.6,
      title: 'Images carry a text alternative',
      detail:
        images.length === 0
          ? 'No images are exposed to the agent.'
          : `${namedImages.length} of ${images.length} images have an accessible name.`,
      evidence: { images: images.length, namedImages: namedImages.length },
      fix:
        images.length > 0 && ratioScore(namedImages.length, images.length) < 0.9
          ? 'Give meaningful images alt text so a browser-capable agent can read their content, and mark decorative images as such.'
          : undefined,
    }),
    signal({
      id: 'smart-landmarks',
      category: ESmartAgentCategory.UNDERSTANDABLE_STRUCTURE,
      score: thresholdScore(landmarkCount, 3, 1),
      weight: 0.45,
      title: 'Page landmarks are understandable',
      detail: `The snapshot contains ${landmarkCount} semantic landmarks.`,
      evidence: { landmarkCount },
      fix:
        landmarkCount < 3
          ? 'Add semantic main, nav, header, footer and named region landmarks around the page structure.'
          : undefined,
    }),
    signal({
      id: 'smart-headings',
      category: ESmartAgentCategory.UNDERSTANDABLE_STRUCTURE,
      score: headingStructureScore(headingLevels, headingCount),
      weight: 0.55,
      title: 'Heading hierarchy is usable',
      detail:
        headingCount > 0
          ? `The agent sees ${headingCount} headings${headingLevels.length > 0 ? ` across levels ${uniqueNumbers(headingLevels).join(', ')}` : ''}.`
          : 'The agent does not see a heading hierarchy.',
      evidence: { headingCount, headingLevels },
      fix:
        headingCount === 0
          ? 'Expose one descriptive H1 and organize sections with sequential headings.'
          : hasHeadingJump(headingLevels)
            ? 'Keep heading levels sequential so agents can infer section relationships.'
            : undefined,
    }),
    signal({
      id: 'smart-page-title',
      category: ESmartAgentCategory.CONTENT_QUALITY,
      score:
        observation.title.trim().length >= 8 ? 1 : observation.title.trim().length > 0 ? 0.5 : 0,
      weight: 0.3,
      title: 'Page purpose is named',
      detail:
        observation.title.trim().length > 0
          ? `The rendered page title is "${observation.title.trim()}".`
          : 'The rendered page has no title.',
      evidence: { title: observation.title },
      fix:
        observation.title.trim().length < 8
          ? 'Use a specific page title that states the page purpose and organization or product name.'
          : undefined,
    }),
    signal({
      id: 'smart-content-depth',
      category: ESmartAgentCategory.CONTENT_QUALITY,
      score: thresholdScore(contentNodeCount, 20, 6),
      weight: 0.4,
      title: 'Content has enough depth',
      detail: `The agent can identify ${contentNodeCount} structured content nodes.`,
      evidence: { contentNodeCount },
      fix:
        contentNodeCount < 20
          ? 'Add self-contained explanations, descriptive headings and concrete supporting detail.'
          : undefined,
    }),
    signal({
      id: 'smart-named-elements',
      category: ESmartAgentCategory.CONTENT_QUALITY,
      score: ratioScore(namedRefs.length, refs.length),
      weight: 0.3,
      title: 'Elements carry understandable names',
      detail: `${namedRefs.length} of ${refs.length} referenced elements have an accessible name.`,
      evidence: { namedElements: namedRefs.length, referencedElements: refs.length },
      fix:
        ratioScore(namedRefs.length, refs.length) < 0.9
          ? 'Give links, controls and regions concise accessible names that explain their purpose.'
          : undefined,
    }),
    signal({
      id: 'smart-controls',
      category: ESmartAgentCategory.ACCESSIBLE_CONTROLS,
      score: ratioScore(namedInteractiveRefs.length, interactiveRefs.length),
      title: 'Interactive controls are addressable',
      detail:
        interactiveRefs.length === 0
          ? 'No interactive controls are required on this page.'
          : `${namedInteractiveRefs.length} of ${interactiveRefs.length} controls have usable names.`,
      evidence: {
        interactiveElements: interactiveRefs.length,
        namedInteractiveElements: namedInteractiveRefs.length,
      },
      fix:
        ratioScore(namedInteractiveRefs.length, interactiveRefs.length) < 0.9
          ? 'Add visible labels or accessible names to every interactive control.'
          : undefined,
    }),
    signal({
      id: 'smart-navigation',
      category: ESmartAgentCategory.NAVIGABILITY,
      score: links.length === 0 ? 0.25 : ratioScore(namedLinks.length, links.length),
      title: 'Navigation links are discoverable',
      detail:
        links.length === 0
          ? 'The agent cannot find any navigational links.'
          : `${namedLinks.length} of ${links.length} links have understandable names.`,
      evidence: { links: links.length, namedLinks: namedLinks.length },
      fix:
        links.length === 0
          ? 'Expose semantic links to important destinations and next steps.'
          : ratioScore(namedLinks.length, links.length) < 0.9
            ? 'Replace empty or ambiguous link names with destination-oriented text.'
            : undefined,
    }),
    signal({
      id: 'smart-barriers',
      category: ESmartAgentCategory.BARRIERS,
      score: snapshot.length === 0 ? 0 : barrierMatches.length === 0 ? 1 : 0,
      title: 'No browser barrier obscures the page',
      detail:
        snapshot.length === 0
          ? 'The browser returned an empty accessibility snapshot.'
          : barrierMatches.length === 0
            ? 'No common anti-bot, JavaScript or access challenge was detected.'
            : `The agent encountered possible barriers: ${barrierMatches.join(', ')}.`,
      evidence: { matches: barrierMatches },
      fix:
        snapshot.length === 0 || barrierMatches.length > 0
          ? 'Let read-only browser agents reach public content without a challenge, interstitial or JavaScript-only gate.'
          : undefined,
    }),
  ]

  const categories = categoryScores(signals)
  const overall = Math.round(
    categories.reduce((sum, category) => sum + category.score * category.weight, 0) / 100,
  )
  const finishedAt = new Date()

  return {
    url: observation.requestedUrl,
    finalUrl: observation.finalUrl,
    scoreVersion: SCORE_VERSION,
    overall,
    grade: gradeOf(overall),
    categories,
    signals,
    agentView: {
      title: observation.title,
      snapshot: observation.snapshot,
      interactiveSnapshot: observation.interactiveSnapshot,
      interactiveElements: interactiveRefs,
    },
    startedAt: startedAt.toISOString(),
    finishedAt: finishedAt.toISOString(),
    meta: {
      provider,
      durationMs: Math.max(0, finishedAt.getTime() - startedAt.getTime()),
      agentBrowserVersion,
    },
  }
}

// MARK: - Aggregation

/**
 * Aggregates per-page Smart Agent reports into a site-wide report (primary double-weighted).
 *
 * @param {ISmartAgentReport} primary - Primary page report.
 * @param {ISmartAgentReport[]} pages - Sampled page reports.
 * @returns {ISmartAgentSiteReport} - Aggregated site report.
 * @export
 */
export function aggregateSmartReports(
  primary: ISmartAgentReport,
  pages: ISmartAgentReport[],
): ISmartAgentSiteReport {
  // Pages the browser never reached (about:blank, non-http) didn't render, so
  // they would unfairly drag the score down — drop them from the aggregate.
  const rendered = pages.filter(didRender)
  const overall = Math.round(
    (primary.overall * 2 + rendered.reduce((sum, page) => sum + page.overall, 0)) /
      (2 + rendered.length),
  )
  const categories = primary.categories.map((base) => {
    let weighted = base.score * 2
    let total = 2
    for (const page of rendered) {
      const match = page.categories.find((category) => category.category === base.category)
      if (match !== undefined) {
        weighted += match.score
        total += 1
      }
    }
    return { ...base, score: Math.round(weighted / total), signals: [] }
  })
  return {
    url: primary.finalUrl,
    scoreVersion: primary.scoreVersion,
    overall,
    grade: gradeOf(overall),
    categories,
    primary,
    pages: rendered,
    startedAt: primary.startedAt,
    finishedAt: rendered.at(-1)?.finishedAt ?? primary.finishedAt,
    meta: primary.meta,
  }
}

// MARK: - Internal helpers

/**
 * Checks if a page rendered by verifying it landed on a real http(s) URL.
 */
function didRender(report: ISmartAgentReport): boolean {
  return /^https?:\/\//i.test(report.finalUrl)
}

function signal(input: TSignalInput): ISmartAgentSignal {
  const score = clamp(input.score)
  return {
    id: input.id,
    category: input.category,
    score,
    weight: input.weight ?? 1,
    status: statusFor(score),
    title: input.title,
    detail: input.detail,
    evidence: input.evidence,
    ...(input.fix !== undefined ? { fix: input.fix } : {}),
  }
}

function categoryScores(signals: ISmartAgentSignal[]): ISmartAgentCategoryScore[] {
  return Object.values(ESmartAgentCategory).map((category) => {
    const categorySignals = signals.filter((item) => item.category === category)
    const totalWeight = categorySignals.reduce((sum, item) => sum + item.weight, 0)
    const score =
      totalWeight === 0
        ? 0
        : Math.round(
            (categorySignals.reduce((sum, item) => sum + item.score * item.weight, 0) /
              totalWeight) *
              100,
          )
    return {
      category,
      label: SMART_AGENT_CATEGORY_LABELS[category],
      score,
      weight: SMART_AGENT_CATEGORY_WEIGHTS[category],
      signals: categorySignals,
    }
  })
}

function thresholdScore(value: number, pass: number, warn: number): number {
  if (value >= pass) {
    return 1
  }
  if (value >= warn) {
    return 0.55
  }
  return 0
}

function ratioScore(named: number, total: number): number {
  if (total === 0) {
    return 1
  }
  return named / total
}

function headingStructureScore(levels: number[], count: number): number {
  if (count === 0) {
    return 0
  }
  if (levels.length === 0) {
    return 0.55
  }
  return hasHeadingJump(levels) ? 0.55 : 1
}

function hasHeadingJump(levels: number[]): boolean {
  return levels.some((level, index) => index > 0 && level - (levels[index - 1] ?? level) > 1)
}

function cleanSnapshot(snapshot: string): string {
  return snapshot
    .replace(/^--- AGENT_BROWSER_PAGE_CONTENT[^\n]*---$/gm, '')
    .replace(/^--- END_AGENT_BROWSER_PAGE_CONTENT[^\n]*---$/gm, '')
    .trim()
}

function countMatches(value: string, pattern: RegExp): number {
  return Array.from(value.matchAll(pattern)).length
}

function uniqueMatches(value: string, pattern: RegExp): string[] {
  return [...new Set(Array.from(value.matchAll(pattern), (match) => match[0].toLowerCase()))]
}

function uniqueNumbers(values: number[]): number[] {
  return [...new Set(values)]
}

function clamp(value: number): number {
  return Math.max(0, Math.min(1, value))
}

function statusFor(score: number): TSmartAgentStatus {
  if (score >= 0.85) {
    return ESmartAgentStatus.PASS
  }
  if (score >= 0.45) {
    return ESmartAgentStatus.WARN
  }
  return ESmartAgentStatus.FAIL
}
