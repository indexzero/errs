/*
 * group.js: ErrorGroup for bounded, cancellable concurrency
 *
 * (C) 2011-2025, Charlie Robbins, Nuno Job, and the Contributors.
 * MIT LICENSE
 *
 */

import { ErrorBoundary, makeIterable } from './boundary.js'
import { fail, normalize, ok } from './result.js'

/**
 * @template T
 * @typedef {[T|undefined, Error|undefined] & ({ ok: true, value: T, error: undefined } | { ok: false, value: T|undefined, error: Error })} Result
 */

/**
 * @typedef {{ index: number, promise?: Promise<void> }} Task
 */

/**
 * ErrorGroup - runs thunks with bounded concurrency, collecting every
 * failure into a boundary rather than rejecting on the first one.
 *
 * The group owns the launch. That is the whole difference from passing an
 * array of already-started promises: a thunk has not run yet, so a limit
 * and a cancellation signal can still apply to it.
 */
export class ErrorGroup {
  #limit
  #cancelOnError
  #boundary
  #controller = new AbortController()
  /** @type {Task[]} */
  #tasks = []
  /** @type {Result<unknown>[]} */
  #results = []
  #active = 0
  /** @type {(() => void)[]} */
  #waiting = []
  /** @type {(() => void)|undefined} */
  #detach

  /**
   * Creates a new ErrorGroup
   * @param {object} [options] - Configuration options
   * @param {number} [options.limit=Infinity] - Maximum tasks in flight at once
   * @param {AbortSignal} [options.signal] - External signal; aborting it aborts the group
   * @param {boolean} [options.cancelOnError=false] - Abort remaining tasks on first failure
   * @param {ErrorBoundary} [options.boundary] - Boundary to collect into
   * @param {number} [options.maxErrors] - Passed through to a new boundary
   * @param {boolean} [options.captureStack] - Passed through to a new boundary
   */
  constructor(options = {}) {
    this.#limit = options.limit ?? Number.POSITIVE_INFINITY
    if (!(this.#limit >= 1)) {
      throw new RangeError(`group limit must be at least 1, got ${options.limit}`)
    }

    this.#cancelOnError = options.cancelOnError ?? false
    this.#boundary =
      options.boundary ??
      new ErrorBoundary({
        ...(options.maxErrors === undefined ? {} : { maxErrors: options.maxErrors }),
        ...(options.captureStack === undefined ? {} : { captureStack: options.captureStack })
      })

    const external = options.signal
    if (!external) return

    if (external.aborted) {
      this.#controller.abort(external.reason)
      return
    }

    const onAbort = () => this.#controller.abort(external.reason)
    external.addEventListener('abort', onAbort, { once: true })
    this.#detach = () => external.removeEventListener('abort', onAbort)
  }

  /**
   * The group's signal. Passed to every thunk, and aborted when an external
   * signal aborts or when cancelOnError fires.
   * @returns {AbortSignal} The group signal
   */
  get signal() {
    return this.#controller.signal
  }

  /**
   * The boundary holding every collected failure
   * @returns {ErrorBoundary} The boundary
   */
  get boundary() {
    return this.#boundary
  }

  /**
   * Per-task Results in run order, including the ones still pending as holes.
   * Use this for partial results, since wait() keeps strict Result semantics
   * and leaves its value slot undefined when anything failed.
   * @returns {Result<unknown>[]} Copy of the per-task Results
   */
  get results() {
    return [...this.#results]
  }

  /**
   * Number of tasks handed to the group
   * @returns {number} Task count
   */
  get size() {
    return this.#tasks.length
  }

  /**
   * Adds a thunk to the group and starts it as soon as a slot is free
   * @template T
   * @param {(signal: AbortSignal) => T|Promise<T>} fn - Thunk, given the group signal
   * @returns {ErrorGroup} This group for chaining
   */
  run(fn) {
    /** @type {Task} */
    const task = { index: this.#tasks.length }
    this.#tasks.push(task)
    task.promise = this.#execute(task, fn)
    return this
  }

  /**
   * Waits for every task, then reports once.
   * @returns {Promise<Result<unknown[]>>} Result whose value is every task's
   *   value in run order, or whose error is an AggregateError of every failure
   */
  async wait() {
    // Loop rather than awaiting a single snapshot, so a task that calls
    // run() on its own group is still waited for.
    let pending = []
    do {
      pending = this.#tasks.map(task => task.promise)
      await Promise.all(pending)
    } while (this.#tasks.length !== pending.length)

    this.#detach?.()

    // Count from the per-task Results, not from the boundary. A boundary at
    // its maxErrors cap silently discards further errors, so boundary.count
    // would under-report how many tasks actually failed.
    const failed = this.#results.filter(result => result && !result.ok).length
    if (failed === 0) {
      return ok(this.#results.map(result => result.value))
    }

    const collected = this.#boundary.count
    const total = this.#tasks.length
    const label = total === 1 ? 'task' : 'tasks'
    let message = `${failed} of ${total} ${label} failed`
    if (collected < failed) {
      message += `, ${collected} collected (boundary is at its maxErrors limit)`
    }

    // toAggregateError returns null on an empty boundary, which happens when
    // maxErrors is 0. The group still has to report the failure.
    const aggregate =
      this.#boundary.toAggregateError(message) ?? makeIterable(new AggregateError([], message))

    return fail(aggregate)
  }

  /**
   * Runs one task once a slot is free, recording its Result either way
   * @param {Task} task - The task record
   * @param {(signal: AbortSignal) => unknown} fn - The thunk to run
   * @returns {Promise<void>} Resolves when the task settles; never rejects
   */
  async #execute(task, fn) {
    await this.#acquire()

    try {
      const { signal } = this.#controller
      if (signal.aborted) throw signal.reason

      this.#results[task.index] = ok(await fn(signal))
    } catch (error) {
      const normalized = normalize(error)
      this.#results[task.index] = fail(normalized)
      this.#boundary.add(normalized)

      if (this.#cancelOnError && !this.#controller.signal.aborted) {
        const reason = new Error(`group cancelled: ${normalized.message}`)
        reason.name = 'AbortError'
        reason.cause = normalized
        this.#controller.abort(reason)
      }
    } finally {
      this.#release()
    }
  }

  /**
   * Takes a concurrency slot, waiting if the group is at its limit
   * @returns {Promise<void>} Resolves once a slot is held
   */
  async #acquire() {
    if (this.#active < this.#limit) {
      this.#active += 1
      return
    }
    // The slot is handed over directly by #release, so #active is already
    // accounted for when this resolves. Decrementing and re-incrementing
    // instead would let a later task slip past the limit in between.
    await new Promise(resolve => {
      this.#waiting.push(() => resolve(undefined))
    })
  }

  /**
   * Releases a slot, transferring it to the next waiter if there is one
   */
  #release() {
    const next = this.#waiting.shift()
    if (next) {
      next()
      return
    }
    this.#active -= 1
  }
}
