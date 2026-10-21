import { ErrorBoundary, ErrorBoundaryOptions } from './boundary.js'
import { AggregateResult, Result } from './result.js'

/**
 * Options for creating an ErrorGroup
 */
export interface ErrorGroupOptions extends ErrorBoundaryOptions {
  /**
   * Maximum number of tasks in flight at once
   * @default Infinity
   */
  limit?: number
  /**
   * External signal. Aborting it aborts the group, and the group's own
   * signal adopts its reason.
   */
  signal?: AbortSignal
  /**
   * Abort the remaining tasks as soon as one fails. The abort reason is an
   * Error named `AbortError` whose `cause` is the original failure.
   * @default false
   */
  cancelOnError?: boolean
  /**
   * Boundary to collect failures into. A new one is created if omitted.
   */
  boundary?: ErrorBoundary
}

/**
 * ErrorGroup - runs thunks with bounded concurrency, collecting every
 * failure into a boundary rather than rejecting on the first one.
 *
 * The group owns the launch. That is the whole difference from passing an
 * array of already-started promises: a thunk has not run yet, so a limit
 * and a cancellation signal can still apply to it.
 */
export class ErrorGroup {
  /**
   * Creates a new ErrorGroup
   * @param options - Configuration options
   * @throws RangeError if `limit` is below 1
   */
  constructor(options?: ErrorGroupOptions)

  /**
   * The group's signal, passed to every thunk. Aborted when an external
   * signal aborts or when cancelOnError fires.
   */
  readonly signal: AbortSignal

  /**
   * The boundary holding every collected failure
   */
  readonly boundary: ErrorBoundary

  /**
   * Results of the tasks that have settled, in run order.
   *
   * Tasks still in flight are omitted rather than appearing as `undefined`,
   * so the array is always dense but may be shorter than `size`.
   */
  readonly results: Result<unknown>[]

  /**
   * Number of tasks handed to the group
   */
  readonly size: number

  /**
   * Adds a thunk to the group and starts it as soon as a slot is free
   * @param fn - Thunk, given the group's signal as its only argument
   * @returns This group for chaining
   */
  run<T>(fn: (signal: AbortSignal) => T | Promise<T>): this

  /**
   * Waits for every task, then reports once
   * @returns Result whose value is every task's value in run order, or
   *   whose error is an AggregateError of every failure
   */
  wait(): Promise<AggregateResult<unknown[]>>
}
