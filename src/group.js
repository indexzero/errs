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
 * @typedef {([T, undefined] & { ok: true, value: T, error: undefined }) | ([T|undefined, Error] & { ok: false, value: T|undefined, error: Error })} Result
 */

/**
 * A Result whose error, when present, is an iterable AggregateError.
 * Kept in step with the AggregateResult alias in group.d.ts; the conformance
 * check in test/types compares the two.
 * @template T
 * @typedef {([T, undefined] & { ok: true, value: T, error: undefined }) | ([T|undefined, AggregateError & Iterable<Error>] & { ok: false, value: T|undefined, error: AggregateError & Iterable<Error> })} AggregateResult
 */

/**
 * @typedef {{ index: number, promise?: Promise<void> }} Task
 */

/**
 * Removes a group's abort listener once the group itself is collected.
 *
 * The listener cannot be removed in wait(), because a group may be reused
 * afterwards and must keep honouring its signal. Without this, every group
 * created against a long-lived signal would leave an entry behind for that
 * signal's whole lifetime.
 * @type {FinalizationRegistry<{ signal: AbortSignal, listener: () => void }>}
 */
const detachOnCollect = new FinalizationRegistry(({ signal, listener }) => {
  signal.removeEventListener('abort', listener)
})

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
  /** @type {Error[]} */
  #failures = []

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
    if (!(this.#limit >= 1) || !(Number.isInteger(this.#limit) || this.#limit === Infinity)) {
      throw new RangeError(
        `group limit must be a positive integer or Infinity, got ${options.limit}`
      )
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

    // A WeakRef so a group that is finished with but never waited on can
    // still be collected; the listener would otherwise pin it, and its
    // results, for the whole lifetime of a long-lived shutdown signal.
    // The listener is deliberately NOT removed in wait(): a group may be
    // reused after waiting, and it must keep honouring its signal.
    const ref = new WeakRef(this)
    const listener = () => {
      const group = ref.deref()
      if (group) group.#adopt(external.reason)
    }

    external.addEventListener('abort', listener, { once: true })
    detachOnCollect.register(this, { signal: external, listener })
  }

  /**
   * Adopts an external abort reason onto the group's own controller
   * @param {unknown} reason - The external signal's reason
   */
  #adopt(reason) {
    if (!this.#controller.signal.aborted) {
      this.#controller.abort(reason)
    }
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
    // Array.from over a length, not a spread: #results is sparse while tasks
    // are in flight, and spreading would materialize holes as undefined
    // elements under a type that promises dense Results.
    return Array.from({ length: this.#tasks.length }, (_, index) => this.#results[index]).filter(
      result => result !== undefined
    )
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
    if (typeof fn !== 'function') {
      // A programming error at the call site, not a task failure. Collecting
      // "fn is not a function" into the aggregate would disguise it as one.
      throw new TypeError(`group.run() expects a function, got ${typeof fn}`)
    }

    /** @type {Task} */
    const task = { index: this.#tasks.length }
    this.#tasks.push(task)
    task.promise = this.#execute(task, fn)
    return this
  }

  /**
   * Waits for every task, then reports once.
   *
   * Tasks a running task adds are waited for too, so a task that keeps
   * calling run() keeps wait() pending. That matches Go's errgroup, where
   * Wait returns only once every Go call has returned.
   * @returns {Promise<AggregateResult<unknown[]>>} Result whose value is every
   *   task's value in run order, or whose error is an AggregateError of every
   *   failure
   */
  async wait() {
    // Loop rather than awaiting a single snapshot, so a task that calls
    // run() on its own group is still waited for.
    let pending = []
    do {
      pending = this.#tasks.map(task => task.promise)
      await Promise.all(pending)
    } while (this.#tasks.length !== pending.length)

    // Count and aggregate from this group's own failures, never from the
    // boundary. The boundary may be shared with other groups, may have been
    // pre-filled, may be at its maxErrors cap, and may be cleared underneath
    // us; any of those make boundary.count a wrong answer to "how many of my
    // tasks failed", and could drop a failure from the aggregate silently.
    const failed = this.#failures.length
    if (failed === 0) {
      return /** @type {AggregateResult<unknown[]>} */ (
        ok(this.#results.map(result => result.value))
      )
    }

    const total = this.#tasks.length
    const label = total === 1 ? 'task' : 'tasks'
    const message = `${failed} of ${total} ${label} failed`

    // Cast because fail() is generic over the value, not the error; the
    // aggregate is iterable by construction via makeIterable.
    return /** @type {AggregateResult<unknown[]>} */ (
      fail(makeIterable(new AggregateError([...this.#failures], message)))
    )
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
      this.#failures.push(normalized)

      // A caller-supplied boundary is foreign code. If its add() throws, that
      // must not escape as an unhandled rejection and lose the real failure,
      // which is already recorded above.
      try {
        this.#boundary.add(normalized)
      } catch {
        // The failure is in #failures and #results either way.
      }

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
