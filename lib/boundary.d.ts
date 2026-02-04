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

/**
 * Result type for trap operations
 */
export type Result<T> = { ok: true; value: T } | { ok: false; error: Error }

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
  toAggregateError(message?: string): AggregateError | null

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
   * Executes fn, traps error to boundary if thrown, returns Result
   * Named after bash's `trap` command (set -euo pipefail)
   * @param fn - Function to execute
   * @returns Result containing value or error
   */
  trap<T>(fn: () => T): Result<T>

  /**
   * Async version of trap - executes fn, traps error to boundary if thrown
   * @param fn - Async function to execute
   * @returns Promise of Result containing value or error
   */
  trapAsync<T>(fn: () => Promise<T>): Promise<Result<T>>
}
