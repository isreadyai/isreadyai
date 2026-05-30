// MARK: - ANSI

/**
 * Hand-rolled escape codes, zero deps. Color is suppressed when NO_COLOR is set
 * (https://no-color.org) or stdout isn't a TTY, keeping piped/CI output clean.
 * The check is lazy (per call) so tests can flip the env without re-importing.
 */

/** Control Sequence Introducer (ESC + '['); escaped to keep a raw byte out of source. */
const CSI = '\u001b['

function colorEnabled(): boolean {
  if (process.env.NO_COLOR !== undefined && process.env.NO_COLOR !== '') {
    return false
  }
  const force = process.env.FORCE_COLOR
  if (force !== undefined) {
    return force !== '0' && force !== 'false' && force !== ''
  }
  return process.stdout.isTTY === true
}

function wrap(open: number, close: number): (text: string) => string {
  return (text: string): string => {
    if (!colorEnabled()) {
      return text
    }
    return `${CSI}${open}m${text}${CSI}${close}m`
  }
}

// MARK: - Styles

export const reset = `${CSI}0m`
export const bold = wrap(1, 22)
export const dim = wrap(2, 22)
export const italic = wrap(3, 23)
export const underline = wrap(4, 24)

// MARK: - Foreground

export const red = wrap(31, 39)
export const green = wrap(32, 39)
export const yellow = wrap(33, 39)
export const blue = wrap(34, 39)
export const magenta = wrap(35, 39)
export const cyan = wrap(36, 39)
export const gray = wrap(90, 39)
export const white = wrap(97, 39)

// MARK: - Brand

/** Brand lime (#b8f53d — the web's --color-site-accent) via truecolor;
 *  bright green on terminals without 24-bit color support. */
/**
 * Brand accent color (#b8f53d) for text, using truecolor on capable terminals
 * or bright green on 16-color terminals.
 *
 * @param {string} text - The text to colorize with the brand accent.
 * @returns {string} - The text with ANSI escape codes applied (or plain text if color is disabled).
 */
export function accent(text: string): string {
  if (!colorEnabled()) {
    return text
  }
  const colorterm = process.env.COLORTERM ?? ''
  if (colorterm.includes('truecolor') || colorterm.includes('24bit')) {
    return `${CSI}38;2;184;245;61m${text}${CSI}39m`
  }
  return `${CSI}92m${text}${CSI}39m`
}

// MARK: - Background

export const bgGreen = wrap(42, 49)
export const bgYellow = wrap(43, 49)
export const bgRed = wrap(41, 49)
export const bgCyan = wrap(46, 49)

/** Erase from cursor to end of line. */
export const eraseLine = `${CSI}K`

// oxlint-disable-next-line no-control-regex -- intentionally matches the ESC byte to strip ANSI escapes
const ANSI_PATTERN = /\u001b\[[0-9;]*m/g

/**
 * Visible character length, ignoring any embedded ANSI escape sequences.
 *
 * @param {string} text - The text to measure, potentially containing ANSI escape codes.
 * @returns {number} - The visible character count without ANSI escapes.
 */
export function visibleLength(text: string): number {
  return text.replace(ANSI_PATTERN, '').length
}
