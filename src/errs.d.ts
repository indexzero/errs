import { EventEmitter } from 'node:events'
import { ErrorBoundary, ErrorBoundaryOptions } from './boundary.js'
import { ErrorGroup, ErrorGroupOptions } from './group.js'
// ErrorGroup itself is intentionally not re-exported from the root: use
// `errs.group()` for an instance, or import the class from 'errs/group'.
import { Result, TrapOptions } from './result.js'
import { format } from './format.js'

// ErrorBoundary is exported as a type only: errs.js deliberately does not
// re-export the class, so `new ErrorBoundary()` from the root would throw at
// import time. Use `errs.boundary()`, or import the class from 'errs/boundary'.
export type { ErrorBoundary, ErrorBoundaryOptions } from './boundary.js'
export type { ErrorGroupOptions } from './group.js'
export type { AggregateResult, Result, TrapOptions } from './result.js'
export { format } from './format.js'
export type { FormatOptions } from './format.js'

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
 * An error constructor: a registrable error type, or a class to match against.
 *
 * The parameters are `any[]` rather than `unknown[]` because parameters are
 * contravariant: an `unknown[]` signature rejects every subclass that declares
 * a typed constructor, which is to say every real error class. `never[]` would
 * accept them, but would then reject `new registered.myError('boom')`.
 */
// biome-ignore lint/suspicious/noExplicitAny: see above; unknown[] rejects every real error subclass
export type ErrorTypeConstructor<E extends Error = Error> = new (...args: any[]) => E

/**
 * Anything create() accepts in its options slot: a message string, an array of
 * message parts, an options object, or a thunk returning one of those.
 */
export type CreateInput =
  | string
  | string[]
  | ErrorOptions
  | (() => string | string[] | ErrorOptions)

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
export const registered: Record<string, ErrorTypeConstructor>

/**
 * Creates a new error instance with the specified type and options
 * @param type - Registered error type to create, or options if no type
 * @param opts - Options for creating the error
 * @returns The created error
 */
export function create(type?: string, opts?: CreateInput): Error
export function create(opts?: CreateInput): Error

/**
 * Merges an existing error with a new error instance
 * @param err - The error to merge, which need not be an Error
 * @param type - Registered error type, or options if no type
 * @param opts - Options for creating the error
 * @returns The merged error with cause chain
 */
export function merge(err: unknown, type?: string | CreateInput, opts?: CreateInput): Error

/**
 * Handles an error by invoking a callback or emitting on an EventEmitter
 * @param error - Error to handle
 * @param callback - Continuation or stream to pass the error to
 * @param stream - Explicit EventEmitter to use
 * @returns EventEmitter if no callback provided
 */
export function handle(
  error: Error | CreateInput,
  callback?: ((err: Error) => void) | EventEmitter,
  stream?: EventEmitter
): EventEmitter | undefined

/**
 * Registers an error type for future calls to create()
 * @param type - Type of the error to register
 * @param proto - Constructor function of the error to register
 */
export function register(type: string, proto: ErrorTypeConstructor): void
export function register(proto: ErrorTypeConstructor): void

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
export function toJSON(error: Error): Record<string, unknown>

/**
 * Type guard: checks if error is instance of ErrorClass
 * @param error - The error to check
 * @param ErrorClass - The error class to check against
 * @returns True if error is instance of ErrorClass
 */
export function isErrorType<E extends Error>(
  error: unknown,
  ErrorClass: ErrorTypeConstructor<E>
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
  ErrorClass: ErrorTypeConstructor<E>,
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
  input: AggregateError | ErrorBoundary | Iterable<Error> | Error[] | Error | null | undefined
): Record<string, Error[]>

/**
 * Selects the errors that are instances of a given class.
 * The constructor-based counterpart to byName
 * @param input - An AggregateError, boundary, array or iterable of errors
 * @param ErrorClass - Class to match against
 * @returns Matching errors, in encounter order
 */
export function pick<E extends Error>(
  input: AggregateError | ErrorBoundary | Iterable<Error> | Error[] | Error | null | undefined,
  ErrorClass: ErrorTypeConstructor<E>
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
