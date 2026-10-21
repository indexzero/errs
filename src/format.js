/*
 * format.js: Multi-format error output utilities
 *
 * (C) 2011-2025, Charlie Robbins, Nuno Job, and the Contributors.
 * MIT LICENSE
 *
 */

import { styleText } from 'node:util'

/**
 * One link in a cause chain, as the walkers below actually read it.
 *
 * `Error` is not enough on its own: `cause` is typed `unknown` there, and an
 * AggregateError's `errors` is not declared on `Error` at all. Both are
 * declared here so a chain can be walked without a cast per hop. Every read
 * is still guarded, because a `cause` can be any thrown value.
 * @typedef {Error & { cause?: ChainLink, errors?: unknown }} ChainLink
 */

/**
 * A color, background or modifier name accepted by `styleText`
 * @typedef {Parameters<typeof styleText>[0]} StyleFormat
 */

/**
 * Applies a style to a string, or returns it unchanged when colors are off
 * @typedef {(text: string, style: StyleFormat) => string} Styler
 */

/**
 * Formats an error for various output targets
 * @param {Error} error - The error to format
 * @param {object} [options] - Formatting options
 * @param {'terminal'|'json'|'html'} [options.format='terminal'] - Output format
 * @param {boolean} [options.colors=true] - Use colors in terminal output
 * @param {number} [options.indent=2] - JSON indentation spaces
 * @returns {string} Formatted error string
 */
export function format(error, options = {}) {
  const { format: fmt = 'terminal', colors = true, indent = 2 } = options

  switch (fmt) {
    case 'terminal':
      return formatTerminal(error, { colors })
    case 'json':
      return formatJSON(error, { indent })
    case 'html':
      return formatHTML(error)
    default:
      throw new Error(`Unknown format: ${fmt}`)
  }
}

/**
 * The message of any thrown value, without assuming it is an Error
 * @param {unknown} value - The value to read
 * @returns {string} Its message, or a safe string form
 */
function messageOf(value) {
  const named = /** @type {{ message?: unknown }} */ (value)
  if (typeof named?.message === 'string') return named.message
  if (value === null) return 'null'
  if (value === undefined) return 'undefined'
  try {
    return String(value)
  } catch {
    return Object.prototype.toString.call(value)
  }
}

/**
 * Describes any thrown value as `Name: message`, without assuming it is an
 * Error. A cause or an aggregate member can be a string, a number, null, or
 * a null-prototype object whose String() conversion throws.
 * @param {unknown} value - The value to describe
 * @returns {string} A single-line description
 */
function describe(value) {
  if (value instanceof Error) {
    return `${value.name}: ${value.message}`
  }
  if (value === null) return 'null'
  if (value === undefined) return 'undefined'

  const named = /** @type {{ name?: unknown, message?: unknown }} */ (value)
  if (typeof named?.name === 'string' && typeof named?.message === 'string') {
    return `${named.name}: ${named.message}`
  }

  try {
    return String(value)
  } catch {
    return Object.prototype.toString.call(value)
  }
}

/**
 * Formats an error for terminal output with colors
 * @param {Error} error - The error to format
 * @param {object} options - Formatting options
 * @param {boolean} options.colors - Whether to use colors
 * @returns {string} Formatted terminal string
 */
function formatTerminal(error, { colors }) {
  /** @type {Styler} */
  const style =
    colors && process.stdout.isTTY && process.stdout.hasColors?.()
      ? (s, c) => styleText(c, s)
      : s => s

  /** @type {string[]} */
  const lines = []
  const seen = new Set()
  // The head of the chain is an Error; every `cause` after it is whatever was
  // thrown, which is why ChainLink types the hops rather than Error.
  let current = /** @type {ChainLink|undefined} */ (error)
  let depth = 0
  let collected = 0

  // A cause chain can be circular. Without this guard the loop appends
  // forever and V8 aborts the process while it is trying to report an error.
  while (current && !seen.has(current)) {
    seen.add(current)
    const prefix = depth === 0 ? '╭─' : '├─ Caused by:'
    lines.push(style(`${prefix} ${describe(current)}`, 'red'))
    lines.push('│')

    if (current.stack) {
      const stackLines = current.stack.split('\n').slice(1, 4)
      for (const line of stackLines) {
        lines.push(`│  ${style(line.trim(), 'gray')}`)
      }
      lines.push('│')
    }

    // An AggregateError's siblings live on `errors`, which is a different
    // axis from `cause`: a flat list of what failed, not a chain of why.
    // List them one per line rather than walking each one's own chain,
    // which would bury the summary under dozens of stack frames.
    const siblings = Array.isArray(current.errors) ? current.errors : []
    if (siblings.length > 0) {
      collected += siblings.length
      const label = siblings.length === 1 ? 'error' : 'errors'
      lines.push(style(`├─ ${siblings.length} ${label} collected:`, 'red'))

      const width = String(siblings.length).length
      for (const [index, sibling] of siblings.entries()) {
        const number = String(index + 1).padStart(width, ' ')
        const nested = Array.isArray(sibling?.errors) ? sibling.errors.length : 0
        const suffix = nested > 0 ? style(` (+${nested} nested)`, 'gray') : ''
        lines.push(`│  ${number}. ${style(describe(sibling), 'red')}${suffix}`)
      }
      lines.push('│')
    }

    current = current.cause
    depth++
  }

  const footer = [`${depth} error${depth > 1 ? 's' : ''} in chain`]
  if (collected > 0) {
    footer.push(`${collected} collected`)
  }
  lines.push(`╰─ ${footer.join(', ')}`)
  return lines.join('\n')
}

/**
 * Formats an error as JSON
 * @param {Error} error - The error to format
 * @param {object} options - Formatting options
 * @param {number} options.indent - JSON indentation
 * @returns {string} JSON string
 */
function formatJSON(error, { indent }) {
  const ancestors = new Set()

  /**
   * Serializes one value of a cause chain or aggregate
   * @param {unknown} err - The value to serialize, which need not be an Error
   * @param {number} [depth] - Current recursion depth
   * @returns {unknown} A JSON-safe representation
   */
  function serialize(err, depth = 0) {
    if (depth > 10) return { truncated: true }
    // A non-object member of an aggregate (null, a string, a number) has no
    // properties to read; return it verbatim rather than crashing.
    if (err === null || typeof err !== 'object') {
      return err
    }
    // An ancestor stack, not a visited set: a shared reference is not a
    // cycle, and under cancelOnError every sibling shares one AbortError.
    if (ancestors.has(err)) return { circular: true }
    ancestors.add(err)

    // Read loosely: the value is known to be a non-null object, but not that
    // it is an Error, and its own metadata keys are copied below by name.
    const link = /** @type {ChainLink & Record<string, unknown>} */ (err)

    /** @type {Record<string, unknown>} */
    const obj = {
      name: link.name,
      message: link.message,
      stack: link.stack?.split('\n')
    }

    if (link.cause) {
      obj.cause = serialize(link.cause, depth + 1)
    }

    if (err instanceof AggregateError && err.errors) {
      obj.errors = err.errors.map(e => serialize(e, depth + 1))
    }

    for (const key of Object.keys(link)) {
      if (!(key in obj)) {
        const value = link[key]
        if (value && typeof value === 'object') {
          obj[key] = serialize(value, depth + 1)
        } else {
          obj[key] = value
        }
      }
    }

    ancestors.delete(err)
    return obj
  }

  return JSON.stringify(serialize(error), null, indent)
}

/**
 * Formats an error as HTML
 * @param {Error} error - The error to format
 * @returns {string} HTML string
 */
function formatHTML(error) {
  /** @type {(value: string) => string} */
  const escapeHtml = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

  let html = '<div class="error-chain">\n'
  const seen = new Set()
  // Same reason as the terminal walker: a `cause` is any thrown value.
  let current = /** @type {ChainLink|undefined} */ (error)

  // Same cycle guard as the terminal walker: a circular cause would grow this
  // string until the process aborts.
  while (current && !seen.has(current)) {
    seen.add(current)
    html += '  <div class="error">\n'
    html += `    <h3 class="error-name">${escapeHtml(String(current?.name ?? 'Error'))}</h3>\n`
    html += `    <p class="error-message">${escapeHtml(messageOf(current))}</p>\n`
    if (current.stack) {
      html += `    <pre class="error-stack">${escapeHtml(current.stack)}</pre>\n`
    }
    html += '  </div>\n'
    current = current.cause
  }

  html += '</div>'
  return html
}
