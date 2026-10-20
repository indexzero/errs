/**
 * Options for creating an ErrorBoundary
 */
export interface ErrorBoundaryOptions {
  /**
   * Maximum number of errors to collect
   * @default 1000
   */
  maxErrors?: number
  /**
   * Whether to capture the stack trace at boundary creation
   * @default true
   */
  captureStack?: boolean
}

// Types only: boundary.js re-exports nothing from result.js at runtime.
export type { Result, TrapOptions } from './result.js'
import { Result, TrapOptions } from './result.js'

/**
 * Makes an AggregateError iterable over its own `errors` array.
 *
 * Defined on the instance rather than via a subclass, so the error's
 * constructor, name and formatting stay exactly those of AggregateError.
 * @param aggregate - The aggregate error to make iterable
 * @returns The same aggregate, now iterable
 */
export function makeIterable<T extends AggregateError>(aggregate: T): T & Iterable<Error>

/**
 * ErrorBoundary - Collects errors without immediate throwing
 */
export class ErrorBoundary {
  /**
   * Creates a new ErrorBoundary
   * @param options - Configuration options
   */
  constructor(options?: ErrorBoundaryOptions)

  /**
   * Adds an error to the boundary
   * @param error - Error to add (non-Error values are converted)
   * @returns This boundary for chaining
   */
  add(error: Error | unknown): this

  /**
   * Checks if any errors have been collected
   * @returns True if errors exist
   */
  hasErrors(): boolean

  /**
   * Gets the count of collected errors
   */
  readonly count: number

  /**
   * Gets a copy of all collected errors
   */
  readonly errors: Error[]

  /**
   * Converts collected errors to an AggregateError
   * @param message - Message for the aggregate error
   * @returns AggregateError or null if no errors
   */
  toAggregateError(message?: string): (AggregateError & Iterable<Error>) | null

  /**
   * Throws an AggregateError if any errors have been collected
   * @param message - Message for the aggregate error
   * @throws AggregateError if errors exist
   */
  throwIfErrors(message?: string): void

  /**
   * Clears all collected errors
   * @returns This boundary for chaining
   */
  clear(): this

  /**
   * Executes fn, traps any error to the boundary, and returns a Result.
   *
   * Always returns a Promise, whether fn is sync, async, or a plain
   * function returning a promise. The sync door is trapSync(), a separate
   * method rather than a second return shape.
   * @param fn - Function to execute
   * @param options - Options, including `or` for the failure value
   * @returns Promise of a Result
   */
  trap<T>(fn: () => T | Promise<T>, options?: TrapOptions<T>): Promise<Result<T>>

  /**
   * Synchronous trap. Returns a Result directly rather than a promise.
   * @param fn - Function to execute
   * @param options - Options, including `or` for the failure value
   * @returns The Result
   */
  trapSync<T>(fn: () => T, options?: TrapOptions<T>): Result<T>

  /**
   * Alias of trap(), kept for v1 compatibility
   * @deprecated Use trap(), which is async for every kind of function
   * @param fn - Async function to execute
   * @param options - Options, including `or` for the failure value
   * @returns Promise of a Result
   */
  trapAsync<T>(fn: () => Promise<T>, options?: TrapOptions<T>): Promise<Result<T>>
}
