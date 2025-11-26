import { EventEmitter } from 'node:events'
import { ErrorBoundary, ErrorBoundaryOptions } from './boundary.js'
import { format, FormatOptions } from './format.js'

export { ErrorBoundary, ErrorBoundaryOptions } from './boundary.js'
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
export function create(type?: string | ErrorOptions | string[] | (() => ErrorOptions), opts?: ErrorOptions): Error
export function create(opts?: ErrorOptions | string | string[] | (() => ErrorOptions)): Error

/**
 * Merges an existing error with a new error instance
 * @param err - The error to merge
 * @param type - Registered error type, or options if no type
 * @param opts - Options for creating the error
 * @returns The merged error with cause chain
 */
export function merge(err: Error | unknown, type?: string | ErrorOptions, opts?: ErrorOptions): Error

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
): EventEmitter | void

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
export function parallel<T>(promises: Promise<T>[], options?: ParallelOptions): Promise<ParallelResult<T>>

/**
 * Converts an error to JSON format
 * @param error - The error to convert
 * @returns JSON representation of the error
 */
export function toJSON(error: Error): Record<string, unknown>

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
}

export default errs
