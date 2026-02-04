/*
 * boundary.js: ErrorBoundary for collecting errors without immediate throwing
 *
 * (C) 2025, Charlie Robbins, Nuno Job, and the Contributors.
 * MIT LICENSE
 *
 */

/**
 * ErrorBoundary - Collects errors without immediate throwing
 */
export class ErrorBoundary {
  #errors = []
  #options
  #createdAt

  /**
   * Creates a new ErrorBoundary
   * @param {object} [options] - Configuration options
   * @param {number} [options.maxErrors=1000] - Maximum errors to collect
   * @param {boolean} [options.captureStack=true] - Capture boundary creation stack
   */
  constructor(options = {}) {
    this.#options = {
      maxErrors: options.maxErrors ?? 1000,
      captureStack: options.captureStack ?? true
    }
    if (this.#options.captureStack) {
      this.#createdAt = new Error('ErrorBoundary created')
    }
  }

  /**
   * Adds an error to the boundary
   * @param {Error|any} error - Error to add
   * @returns {ErrorBoundary} This boundary for chaining
   */
  add(error) {
    if (!(error instanceof Error)) {
      error = new Error(String(error))
    }
    if (this.#errors.length < this.#options.maxErrors) {
      this.#errors.push(error)
    }
    return this
  }

  /**
   * Checks if any errors have been collected
   * @returns {boolean} True if errors exist
   */
  hasErrors() {
    return this.#errors.length > 0
  }

  /**
   * Gets the count of collected errors
   * @returns {number} Error count
   */
  get count() {
    return this.#errors.length
  }

  /**
   * Gets a copy of all collected errors
   * @returns {Error[]} Array of errors
   */
  get errors() {
    return [...this.#errors]
  }

  /**
   * Converts collected errors to an AggregateError
   * @param {string} [message='Multiple errors occurred'] - Message for the aggregate error
   * @returns {AggregateError|null} AggregateError or null if no errors
   */
  toAggregateError(message = 'Multiple errors occurred') {
    if (!this.hasErrors()) return null
    const aggregate = new AggregateError(this.#errors, message)
    if (this.#createdAt) {
      aggregate.cause = this.#createdAt
    }
    return aggregate
  }

  /**
   * Throws an AggregateError if any errors have been collected
   * @param {string} [message] - Message for the aggregate error
   * @throws {AggregateError} If errors exist
   */
  throwIfErrors(message) {
    const aggregate = this.toAggregateError(message)
    if (aggregate) throw aggregate
  }

  /**
   * Clears all collected errors
   * @returns {ErrorBoundary} This boundary for chaining
   */
  clear() {
    this.#errors = []
    return this
  }

  /**
   * Executes fn, traps error to boundary if thrown, returns Result
   * Named after bash's `trap` command (set -euo pipefail)
   * @template T
   * @param {() => T} fn - Function to execute
   * @returns {{ ok: true, value: T } | { ok: false, error: Error }} Result
   */
  trap(fn) {
    try {
      return { ok: true, value: fn() }
    } catch (error) {
      const normalized = error instanceof Error ? error : new Error(String(error))
      this.add(normalized)
      return { ok: false, error: normalized }
    }
  }

  /**
   * Async version of trap - executes fn, traps error to boundary if thrown
   * @template T
   * @param {() => Promise<T>} fn - Async function to execute
   * @returns {Promise<{ ok: true, value: T } | { ok: false, error: Error }>} Promise of Result
   */
  async trapAsync(fn) {
    try {
      return { ok: true, value: await fn() }
    } catch (error) {
      const normalized = error instanceof Error ? error : new Error(String(error))
      this.add(normalized)
      return { ok: false, error: normalized }
    }
  }
}
