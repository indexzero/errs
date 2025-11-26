/*
 * boundary.js: ErrorBoundary for collecting errors without immediate throwing
 *
 * (C) 2025, Charlie Robbins, Nuno Job, and the Contributors.
 * MIT LICENSE
 *
 */

/**
 * ErrorBoundary - Collects errors without immediate throwing (Effect-style)
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
}
