import { EventEmitter } from 'node:events'
import { ErrorBoundary, ErrorBoundaryOptions } from './boundary.js'
import { ErrorGroup, ErrorGroupOptions } from './group.js'
import { Result, TrapOptions } from './result.js'
import { format } from './format.js'

export { ErrorBoundary, ErrorBoundaryOptions } from './boundary.js'
export { ErrorGroup, ErrorGroupOptions } from './group.js'
export { Result, TrapOptions } from './result.js'
export { format, FormatOptions } from './format.js'

/**
 * Options for creating an error
 */
export interface ErrorOptions {
  message?: string
  name?: string
  cause?: Error
  [key: string]: unknown
}

/**
 * Result from parallel operation
 */
export interface ParallelResult<T> {
  results: PromiseSettledResult<T>[]
  boundary: ErrorBoundary
}

/**
 * Options for parallel execution
 */
export interface ParallelOptions extends ErrorBoundaryOptions {
  boundary?: ErrorBoundary
  /**
   * Maximum tasks in flight at once. Thunks only: it cannot apply to
   * promises that have already started.
   */
  limit?: number
  /**
   * Cancellation signal. Thunks only, for the same reason.
   */
  signal?: AbortSignal
  /**
   * Abort the remaining tasks on first failure. Thunks only.
   */
  cancelOnError?: boolean
}

/**
 * Registry of custom error types
 */
export const registered: Record<string, new (...args: unknown[]) => Error>

/**
 * Creates a new error instance with the specified type and options
 * @param type - Registered error type to create, or options if no type
 * @param opts - Options for creating the error
 * @returns The created error
 */
export function create(
  type?: string | ErrorOptions | string[] | (() => ErrorOptions),
  opts?: ErrorOptions
): Error
export function create(opts?: ErrorOptions | string | string[] | (() => ErrorOptions)): Error

/**
 * Merges an existing error with a new error instance
 * @param err - The error to merge
 * @param type - Registered error type, or options if no type
 * @param opts - Options for creating the error
 * @returns The merged error with cause chain
 */
export function merge(
  err: Error | unknown,
  type?: string | ErrorOptions,
  opts?: ErrorOptions
): Error

/**
 * Handles an error by invoking a callback or emitting on an EventEmitter
 * @param error - Error to handle
 * @param callback - Continuation or stream to pass the error to
 * @param stream - Explicit EventEmitter to use
 * @returns EventEmitter if no callback provided
 */
export function handle(
  error: Error | string | ErrorOptions,
  callback?: ((err: Error) => void) | EventEmitter,
  stream?: EventEmitter
): EventEmitter | undefined

/**
 * Registers an error type for future calls to create()
 * @param type - Type of the error to register
 * @param proto - Constructor function of the error to register
 */
export function register(type: string, proto: new (...args: unknown[]) => Error): void
export function register(proto: new (...args: unknown[]) => Error): void

/**
 * Unregisters an error type
 * @param type - Type of the error to unregister
 */
export function unregister(type: string): void

/**
 * Creates an ErrorBoundary for collecting errors
 * @param options - Options for the boundary
 * @returns The error boundary instance
 */
export function boundary(options?: ErrorBoundaryOptions): ErrorBoundary

/**
 * Runs multiple promises in parallel and collects errors
 * @param promises - Array of promises to run
 * @param options - Options including optional boundary
 * @returns Results and boundary
 */
export function parallel<T>(
  tasks: ((signal: AbortSignal) => T | Promise<T>)[] | Promise<T>[],
  options?: ParallelOptions
): Promise<ParallelResult<T>>

/**
 * Converts an error to JSON format
 * @param error - The error to convert
 * @returns JSON representation of the error
 */
export function toJSON(error: Error, seen?: WeakSet<object>): Record<string, unknown>

/**
 * Type guard: checks if error is instance of ErrorClass
 * @param error - The error to check
 * @param ErrorClass - The error class to check against
 * @returns True if error is instance of ErrorClass
 */
export function isErrorType<E extends Error>(
  error: unknown,
  ErrorClass: new (...args: unknown[]) => E
): error is E

/**
 * Type guard: checks if error matches a registered type name
 * @param error - The error to check
 * @param typeName - The registered type name
 * @returns True if error is instance of the registered type
 */
export function isRegisteredType(error: unknown, typeName: string): boolean

/**
 * Asserts error is a specific type, throws TypeError if not
 * @param error - The error to check
 * @param ErrorClass - The expected error class
 * @param message - Custom error message
 * @returns The error, narrowed to type E
 * @throws TypeError if error is not an instance of ErrorClass
 */
export function assertErrorType<E extends Error>(
  error: unknown,
  ErrorClass: new (...args: unknown[]) => E,
  message?: string
): E

/**
 * Executes fn and returns a Result instead of throwing.
 *
 * Always returns a Promise, whether fn is sync, async, or a plain function
 * returning a promise. No boundary is involved, so nothing accumulates:
 * use `boundary.trap()` to collect across several calls.
 * @param fn - Function to execute
 * @param options - Options, including `or` for the failure value
 * @returns Promise of a Result
 */
export function trap<T>(fn: () => T | Promise<T>, options?: TrapOptions<T>): Promise<Result<T>>

/**
 * Synchronous trap. Returns a Result directly rather than a promise.
 * @param fn - Function to execute
 * @param options - Options, including `or` for the failure value
 * @returns The Result
 */
export function trapSync<T>(fn: () => T, options?: TrapOptions<T>): Result<T>

/**
 * Creates an ErrorGroup for bounded, cancellable concurrency
 * @param options - Options for the group
 * @returns The error group instance
 */
export function group(options?: ErrorGroupOptions): ErrorGroup

/**
 * Alias of trapSync()
 * @deprecated Use trapSync()
 * @param fn - Function to execute
 * @returns The Result
 */
export function tryCatch<T>(fn: () => T): Result<T>

/**
 * Alias of trap()
 * @deprecated Use trap(), which is async for every kind of function
 * @param fn - Async function to execute
 * @returns Promise of a Result
 */
export function tryCatchAsync<T>(fn: () => Promise<T>): Promise<Result<T>>

/**
 * Groups errors by their `name`, for destructuring by type
 * @param input - An AggregateError, boundary, array or iterable of errors
 * @returns Errors keyed by name, in encounter order
 * @example
 * const { TimeoutError = [], NotFoundError = [] } = errs.byName(aggregate)
 */
export function byName(
  input: AggregateError | Iterable<Error> | Error[] | Error | null | undefined
): Record<string, Error[]>

/**
 * Selects the errors that are instances of a given class.
 * The constructor-based counterpart to byName
 * @param input - An AggregateError, boundary, array or iterable of errors
 * @param ErrorClass - Class to match against
 * @returns Matching errors, in encounter order
 */
export function pick<E extends Error>(
  input: AggregateError | Iterable<Error> | Error[] | Error | null | undefined,
  ErrorClass: new (...args: never[]) => E
): E[]

declare const errs: {
  registered: typeof registered
  create: typeof create
  merge: typeof merge
  handle: typeof handle
  register: typeof register
  unregister: typeof unregister
  boundary: typeof boundary
  parallel: typeof parallel
  toJSON: typeof toJSON
  format: typeof format
  isErrorType: typeof isErrorType
  isRegisteredType: typeof isRegisteredType
  assertErrorType: typeof assertErrorType
  tryCatch: typeof tryCatch
  tryCatchAsync: typeof tryCatchAsync
  trap: typeof trap
  trapSync: typeof trapSync
  group: typeof group
  byName: typeof byName
  pick: typeof pick
}

export default errs
