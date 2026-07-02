/**
 * RFC 9309 robots.txt parser with AI crawler semantics.
 *
 * Dependency-free parser with group selection by longest matching user-agent token,
 * rule precedence by longest path match, and Allow winning ties (Google / RFC 9309).
 */

// MARK: - robots.txt parser (RFC 9309)

/**
 * A single allow/disallow rule in a robots.txt group.
 *
 * @export
 * @interface IRobotsRule
 * @typedef {IRobotsRule}
 */
export interface IRobotsRule {
  type: 'allow' | 'disallow'
  path: string
}

/**
 * A user-agent group with its rules from robots.txt.
 *
 * @export
 * @interface IRobotsGroup
 * @typedef {IRobotsGroup}
 */
export interface IRobotsGroup {
  agents: string[]
  rules: IRobotsRule[]
}

/**
 * Parsed robots.txt file with groups, sitemaps, and syntax warnings.
 *
 * @export
 * @interface IRobots
 * @typedef {IRobots}
 */
export interface IRobots {
  groups: IRobotsGroup[]
  sitemaps: string[]
  /** Non-fatal syntax oddities worth surfacing in a report. */
  warnings: string[]
}

/**
 * Parse robots.txt content into structured groups and rules.
 *
 * @param {string} text - The raw robots.txt content.
 * @returns {IRobots} Parsed robots.txt with user-agent groups, rules, sitemaps, and warnings.
 * @export
 */
export function parseRobots(text: string): IRobots {
  const groups: IRobotsGroup[] = []
  const sitemaps: string[] = []
  const warnings: string[] = []

  let current: IRobotsGroup | null = null
  let lastWasAgent = false

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.replace(/#.*$/, '').trim()
    if (line.length === 0) {
      continue
    }
    const colon = line.indexOf(':')
    if (colon === -1) {
      warnings.push(`Line without directive: "${truncate(rawLine)}"`)
      continue
    }
    const field = line.slice(0, colon).trim().toLowerCase()
    const value = line.slice(colon + 1).trim()

    switch (field) {
      case 'user-agent': {
        if (!lastWasAgent || current === null) {
          current = { agents: [], rules: [] }
          groups.push(current)
        }
        current.agents.push(value.toLowerCase())
        lastWasAgent = true
        break
      }
      case 'allow':
      case 'disallow': {
        if (current === null) {
          warnings.push(`Rule before any User-agent: "${truncate(rawLine)}"`)
          break
        }
        // Empty Disallow ("allow everything") is kept as a no-op rule.
        current.rules.push({ type: field, path: value })
        lastWasAgent = false
        break
      }
      case 'sitemap': {
        if (value.length > 0) {
          sitemaps.push(value)
        }
        lastWasAgent = false
        break
      }
      case 'crawl-delay':
      case 'host': {
        lastWasAgent = false
        break
      }
      default: {
        warnings.push(`Unknown directive "${field}"`)
        lastWasAgent = false
      }
    }
  }

  return { groups, sitemaps, warnings }
}

/**
 * Find the group governing a crawler by longest user-agent token match (fallback to `*`).
 *
 * @param {IRobots} robots - Parsed robots.txt structure.
 * @param {string} userAgent - The user-agent string to match.
 * @returns {IRobotsGroup | null} The matching user-agent group, or null if none found.
 * @export
 */
export function groupFor(robots: IRobots, userAgent: string): IRobotsGroup | null {
  const ua = userAgent.toLowerCase()
  let best: IRobotsGroup | null = null
  let bestLen = -1
  let star: IRobotsGroup | null = null

  for (const group of robots.groups) {
    for (const agent of group.agents) {
      if (agent === '*') {
        star ??= group
        continue
      }
      if (ua.includes(agent) && agent.length > bestLen) {
        best = group
        bestLen = agent.length
      }
    }
  }
  return best ?? star
}

/**
 * Check if a path is allowed for a user-agent (RFC 9309 semantics).
 *
 * No rules or no matching group defaults to allowed.
 *
 * @param {IRobots} robots - Parsed robots.txt structure.
 * @param {string} userAgent - The user-agent string to check.
 * @param {string} path - The path to check against rules.
 * @returns {boolean} True if the path is allowed, false if disallowed.
 * @export
 */
export function isAllowed(robots: IRobots, userAgent: string, path: string): boolean {
  const group = groupFor(robots, userAgent)
  if (group === null) {
    return true
  }

  let verdict = true
  let bestLen = -1
  for (const rule of group.rules) {
    if (rule.path.length === 0) {
      continue // "Disallow:" (empty) allows everything — never beats a real match
    }
    if (pathMatches(rule.path, path)) {
      const specificity = rule.path.replace(/\*/g, '').length
      if (
        specificity > bestLen ||
        (specificity === bestLen && rule.type === 'allow' && verdict === false)
      ) {
        verdict = rule.type === 'allow'
        bestLen = specificity
      }
    }
  }
  return verdict
}

/**
 * Check if the entire site is blocked for a user-agent (Disallow: /).
 *
 * @param {IRobots} robots - Parsed robots.txt structure.
 * @param {string} userAgent - The user-agent string to check.
 * @returns {boolean} True if the root path is disallowed.
 * @export
 */
export function isFullyBlocked(robots: IRobots, userAgent: string): boolean {
  return !isAllowed(robots, userAgent, '/')
}

/**
 * Check if a user-agent token is explicitly named (not using `*` fallback).
 *
 * @param {IRobots} robots - Parsed robots.txt structure.
 * @param {string} token - The user-agent token to check.
 * @returns {boolean} True if an explicit group names this token.
 * @export
 */
export function hasExplicitGroup(robots: IRobots, token: string): boolean {
  const lowered = token.toLowerCase()
  return robots.groups.some((g) => g.agents.includes(lowered))
}

// MARK: - internal

/**
 * Match a robots path pattern (`*` = any run, trailing `$` = end-anchor, else prefix).
 *
 * Linear two-pointer glob via indexOf — no regex, so a crafted rule/path with many
 * wildcards can't trigger catastrophic backtracking (the scanner fetches untrusted
 * robots.txt). Interior segments match greedily at the earliest position, which is
 * optimal for existence and leaves the most room for an end-anchored tail.
 */
function pathMatches(pattern: string, path: string): boolean {
  const anchored = pattern.endsWith('$')
  const body = anchored ? pattern.slice(0, -1) : pattern
  const segments = body.split('*') // always length >= 1

  // Literal text before the first `*` is anchored to the start of the path.
  const first = segments[0] ?? ''
  if (!path.startsWith(first)) {
    return false
  }
  let pos = first.length

  for (let i = 1; i < segments.length - 1; i++) {
    const seg = segments[i]
    if (!seg) {
      continue // consecutive `*` — no constraint
    }
    const at = path.indexOf(seg, pos)
    if (at === -1) {
      return false
    }
    pos = at + seg.length
  }

  if (segments.length === 1) {
    return anchored ? pos === path.length : true // no `*`: prefix, or exact when anchored
  }

  const last = segments[segments.length - 1] ?? ''
  if (anchored) {
    return path.length - last.length >= pos && path.endsWith(last)
  }
  return last.length === 0 || path.indexOf(last, pos) !== -1
}

function truncate(s: string): string {
  return s.length > 60 ? `${s.slice(0, 57)}…` : s
}
