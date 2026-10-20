/*
 * boundary.js: ErrorBoundary for collecting errors without immediate throwing
 *
 * (C) 2011-2025, Charlie Robbins, Nuno Job, and the Contributors.
 * MIT LICENSE
 *
 */

import { fail, normalize, ok } from './result.js'

/**
 * @template T
 * @typedef {[T|undefined, Error|undefined] & ({ ok: true, value: T, error: undefined } | { ok: false, value: T|undefined, error: Error })} Result
 */

/**
 * Makes an AggregateError iterable over its own `errors` array.
 *
 * Defined on the instance rather than via a subclass so that the error's
 * constructor, name and formatting stay exactly those of AggregateError.
 * The property is non-enumerable, so serialization is unchanged.
 * @template {AggregateError} T
 * @param {T} aggregate - The aggregate error to make iterable
 * @returns {T} The same aggregate, now iterable
 */
export function makeIterable(aggregate) {
  if (typeof aggregate?.[Symbol.iterator] === 'function') return aggregate
  Object.defineProperty(aggregate, Symbol.iterator, {
    value: function* () {
      yield* this.errors ?? []
    },
    writable: true,
    configurable: true,
    enumerable: false
  })
  return aggregate
}

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
   *
   * The returned error is iterable over its own `errors`, so `for..of`,
   * spread and array destructuring all work on it directly. `instanceof
   * AggregateError` and the `errors` property are unaffected.
   * @param {string} [message='Multiple errors occurred'] - Message for the aggregate error
   * @returns {AggregateError|null} AggregateError or null if no errors
   */
  toAggregateError(message = 'Multiple errors occurred') {
    if (!this.hasErrors()) return null
    const aggregate = makeIterable(new AggregateError(this.#errors, message))
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
   * Executes fn, traps any error to the boundary, and returns a Result.
   * Named after bash's `trap` (set -euo pipefail).
   *
   * Always returns a Promise, whether fn is sync, async, or a plain
   * function returning a promise. A function that is sometimes sync and
   * sometimes async is the oldest hazard in Node's history, so the sync
   * door is a separate method rather than a second return shape.
   * @template T
   * @param {() => T|Promise<T>} fn - Function to execute
   * @param {object} [options] - Options
   * @param {T} [options.or] - Value for the first slot on failure, Go's zero value
   * @returns {Promise<Result<T>>} Promise of a Result
   */
  async trap(fn, options = {}) {
    try {
      return ok(await fn())
    } catch (error) {
      const normalized = normalize(error)
      this.add(normalized)
      return fail(normalized, options.or)
    }
  }

  /**
   * Synchronous trap. Executes fn, traps any error to the boundary, and
   * returns a Result directly rather than a promise.
   * @template T
   * @param {() => T} fn - Function to execute
   * @param {object} [options] - Options
   * @param {T} [options.or] - Value for the first slot on failure, Go's zero value
   * @returns {Result<T>} The Result
   */
  trapSync(fn, options = {}) {
    try {
      return ok(fn())
    } catch (error) {
      const normalized = normalize(error)
      this.add(normalized)
      return fail(normalized, options.or)
    }
  }

  /**
   * Alias of trap(), kept for v1 compatibility
   * @deprecated Use trap(), which is async for every kind of function
   * @template T
   * @param {() => Promise<T>} fn - Async function to execute
   * @param {object} [options] - Options
   * @param {T} [options.or] - Value for the first slot on failure
   * @returns {Promise<Result<T>>} Promise of a Result
   */
  trapAsync(fn, options) {
    return this.trap(fn, options)
  }
}
