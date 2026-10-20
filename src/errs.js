/*
 * errs.js: Simple error creation and passing utilities.
 *
 * (C) 2011-2025, Charlie Robbins, Nuno Job, and the Contributors.
 * MIT LICENSE
 *
 */

import { EventEmitter } from 'node:events'
import { ErrorBoundary } from './boundary.js'
import { format } from './format.js'
import { ErrorGroup } from './group.js'
import { fail, normalize, ok } from './result.js'

const registered = {}

/**
 * Creates a new error instance with the specified type and options
 * @param {string} [type] - Registered error type to create
 * @param {string|object|Array|function} [opts] - Options for creating the error
 * @returns {Error} The created error
 */
function create(type, opts) {
  if (opts === undefined && !registered[type]) {
    opts = type
    type = null
  }

  if (opts?.stack) {
    return opts
  }

  let message

  if (typeof opts === 'function') {
    opts = opts()
  }

  if (Array.isArray(opts)) {
    message = opts.join(' ')
    opts = null
  } else if (opts) {
    switch (typeof opts) {
      case 'string':
        message = opts || 'Unspecified error'
        opts = null
        break
      case 'object':
        message = opts?.message || 'Unspecified error'
        break
      default:
        message = 'Unspecified error'
        break
    }
  }

  const ErrorProto = (type && registered[type]) || Error
  const error = new ErrorProto(message)

  if (!error.name || error.name === 'Error') {
    error.name = opts?.name || ErrorProto.name || 'Error'
  }

  if (!error.stack) {
    Error.captureStackTrace?.(error, create)
  } else if (Error.captureStackTrace) {
    // V8 only - we understand the format
    const lines = error.stack.split('\n')
    if (lines[0]?.includes(error.message || '')) {
      lines.splice(1, 1)
      error.stack = lines.join('\n')
    }
  }

  if (opts) {
    Object.keys(opts).forEach(key => {
      error[key] = opts[key]
    })
  }

  return error
}

/**
 * Merges an existing error with a new error instance
 * @param {Error} err - The error to merge
 * @param {string} [type] - Registered error type to create
 * @param {string|object|Array|function} [opts] - Options for creating the error
 * @returns {Error} The merged error
 */
function merge(err, type, opts) {
  const merged = create(type, opts)

  if (err == null) {
    return merged
  }

  if (!Array.isArray(err) && typeof err === 'object') {
    Object.keys(err).forEach(key => {
      if (['stack', 'type', 'arguments', 'message'].indexOf(key) === -1) {
        merged[key] = err[key]
      }
    })
  }

  merged.name = merged.name || err.name
  merged.message = merged.message || err.message
  merged.stack = err.stack || merged.stack

  // Set native cause chain
  if (err instanceof Error) {
    merged.cause = err
  }

  return merged
}

/**
 * Handles an error by invoking a callback or emitting on an EventEmitter
 * @param {Error|string|object} error - Error to handle
 * @param {function|EventEmitter} [callback] - Continuation or stream to pass the error to
 * @param {EventEmitter} [stream] - Explicit EventEmitter to use
 * @returns {EventEmitter|undefined} EventEmitter if no callback provided
 */
function handle(error, callback, stream) {
  error = create(error)

  if (typeof callback === 'function') {
    callback(error)
  }

  if (typeof callback !== 'function' || stream) {
    const emitter = stream || callback || new EventEmitter()
    queueMicrotask(() => {
      emitter.emit('error', error)
    })
    return emitter
  }
}

/**
 * Registers an error type for future calls to create()
 * @param {string} type - Type of the error to register
 * @param {function} proto - Constructor function of the error to register
 */
function register(type, proto) {
  if (arguments.length === 1) {
    proto = type
    type = proto.name.toLowerCase()
  }
  registered[type] = proto
}

/**
 * Unregisters an error type
 * @param {string} type - Type of the error to unregister
 */
function unregister(type) {
  delete registered[type]
}

/**
 * Creates an ErrorBoundary for collecting errors
 * @param {object} [options] - Options for the boundary
 * @returns {ErrorBoundary} The error boundary instance
 */
function boundary(options) {
  return new ErrorBoundary(options)
}

/**
 * Creates an ErrorGroup for bounded, cancellable concurrency
 * @param {object} [options] - Options for the group
 * @returns {ErrorGroup} The error group instance
 */
function group(options) {
  return new ErrorGroup(options)
}

let warnedAboutPromises = false

/**
 * Warns once that started promises cannot be bounded or cancelled
 */
function warnAboutPromises() {
  if (warnedAboutPromises) return
  warnedAboutPromises = true

  const message =
    'errs.parallel() was given started promises. Pass thunks (() => work()) ' +
    'so that `limit` and `signal` can apply; work already in flight cannot ' +
    'be bounded or cancelled.'

  if (typeof process !== 'undefined' && typeof process.emitWarning === 'function') {
    process.emitWarning(message, 'DeprecationWarning')
  } else {
    console.warn(message)
  }
}

/**
 * Runs multiple tasks concurrently and collects every error.
 *
 * Prefers thunks, which the group launches itself so that `limit` and
 * `signal` apply. An array of already-started promises still works and
 * keeps the v1 behaviour, but warns once, because neither option can
 * apply to work that is already running.
 * @param {Array<(signal: AbortSignal) => unknown>|Promise[]} tasks - Thunks or promises
 * @param {object} [options] - Options
 * @param {number} [options.limit] - Maximum tasks in flight, thunks only
 * @param {AbortSignal} [options.signal] - Cancellation signal, thunks only
 * @param {boolean} [options.cancelOnError] - Abort siblings on first failure, thunks only
 * @param {ErrorBoundary} [options.boundary] - Boundary to collect into
 * @returns {Promise<{results: Array, boundary: ErrorBoundary}>} Results and boundary
 */
async function parallel(tasks, options = {}) {
  const list = [...tasks]
  const thunks = list.filter(task => typeof task === 'function')

  if (thunks.length === list.length) {
    const errorGroup = new ErrorGroup(options)
    for (const fn of list) {
      errorGroup.run(/** @type {(signal: AbortSignal) => unknown} */ (fn))
    }
    await errorGroup.wait()

    const results = errorGroup.results.map(result =>
      result.ok
        ? { status: 'fulfilled', value: result.value }
        : { status: 'rejected', reason: result.error }
    )
    return { results, boundary: errorGroup.boundary }
  }

  if (thunks.length > 0) {
    // Attach a no-op handler to the promises that were already started before
    // refusing the call, so the argument error is what the caller sees rather
    // than an unrelated unhandledRejection crash a tick later.
    for (const task of list) {
      if (typeof task?.then === 'function') task.then(undefined, () => {})
    }
    throw new TypeError(
      `parallel() takes either all thunks or all promises, got ${thunks.length} ` +
        `thunk(s) among ${list.length} tasks`
    )
  }

  warnAboutPromises()
  const results = await Promise.allSettled(list)
  const errorBoundary = options.boundary ?? new ErrorBoundary(options)

  for (const result of results) {
    if (result.status === 'rejected') {
      errorBoundary.add(result.reason)
    }
  }

  return { results, boundary: errorBoundary }
}

/**
 * Converts an error to JSON format
 * @param {Error} error - The error to convert
 * @returns {object} JSON representation of the error
 */
function toJSON(error) {
  return serialize(error, new Set())
}

/**
 * Recursively serializes an error-like value.
 *
 * `ancestors` is an ancestor stack, not a visited set: entries are removed on
 * the way out. A visited set would report any repeated reference as circular,
 * and repeats are normal here -- under cancelOnError every sibling rejects
 * with the same AbortError object, and that AbortError's cause is the root
 * failure. Those are shared references in a DAG, not cycles.
 * @param {unknown} value - The value to serialize
 * @param {Set<unknown>} ancestors - Values currently being serialized
 * @returns {unknown} A JSON-safe representation
 */
function serialize(value, ancestors) {
  if (value == null || typeof value !== 'object') {
    return value
  }
  if (ancestors.has(value)) {
    return '[Circular]'
  }
  ancestors.add(value)

  try {
    const error = /** @type {Record<string, any>} */ (value)

    if (Array.isArray(error)) {
      return error.map(entry => serialize(entry, ancestors))
    }

    const obj = {
      name: error.name,
      message: error.message,
      stack: error.stack,
      arguments: error.arguments,
      type: error.type
    }

    for (const key of Object.keys(error)) {
      if (!(key in obj)) {
        // Recurse through own properties too: custom metadata can be
        // circular, and copying it by reference leaves output that
        // JSON.stringify cannot serialize.
        obj[key] = serialize(error[key], ancestors)
      }
    }

    // `cause` and an AggregateError's `errors` are the two axes an error can
    // branch along, and both are non-enumerable when set by the constructor,
    // so the Object.keys() copy above misses them.
    if (error.cause != null) {
      obj.cause = serialize(error.cause, ancestors)
    }
    if (Array.isArray(error.errors)) {
      obj.errors = error.errors.map(nested => serialize(nested, ancestors))
    }

    return obj
  } finally {
    ancestors.delete(value)
  }
}

/**
 * Type guard: checks if error is instance of ErrorClass
 * @template {Error} E
 * @param {unknown} error - The error to check
 * @param {new (...args: any[]) => E} ErrorClass - The error class to check against
 * @returns {error is E} True if error is instance of ErrorClass
 */
function isErrorType(error, ErrorClass) {
  return error instanceof ErrorClass
}

/**
 * Type guard: checks if error matches a registered type name
 * @param {unknown} error - The error to check
 * @param {string} typeName - The registered type name
 * @returns {boolean} True if error is instance of the registered type
 */
function isRegisteredType(error, typeName) {
  const ErrorClass = registered[typeName]
  return ErrorClass ? error instanceof ErrorClass : false
}

/**
 * Asserts error is a specific type, throws TypeError if not
 * @template {Error} E
 * @param {unknown} error - The error to check
 * @param {new (...args: any[]) => E} ErrorClass - The expected error class
 * @param {string} [message] - Custom error message
 * @returns {E} The error, narrowed to type E
 * @throws {TypeError} If error is not an instance of ErrorClass
 */
function assertErrorType(error, ErrorClass, message) {
  if (!(error instanceof ErrorClass)) {
    throw new TypeError(
      message ?? `Expected ${ErrorClass.name}, got ${error?.constructor?.name ?? typeof error}`
    )
  }
  return error
}

/**
 * @template T
 * @typedef {([T, undefined] & { ok: true, value: T, error: undefined }) | ([T|undefined, Error] & { ok: false, value: T|undefined, error: Error })} Result
 */

/**
 * Executes fn and returns a Result instead of throwing.
 *
 * Always returns a Promise, whether fn is sync, async, or a plain function
 * returning a promise. No boundary is involved, so nothing accumulates:
 * use boundary.trap() to collect across several calls.
 * @template T
 * @param {() => T|Promise<T>} fn - Function to execute
 * @param {object} [options] - Options
 * @param {T} [options.or] - Value for the first slot on failure, Go's zero value
 * @returns {Promise<Result<T>>} Promise of a Result
 */
async function trap(fn, options = {}) {
  try {
    return ok(await fn())
  } catch (error) {
    return fail(normalize(error), options.or)
  }
}

/**
 * Synchronous trap. Returns a Result directly rather than a promise.
 * @template T
 * @param {() => T} fn - Function to execute
 * @param {object} [options] - Options
 * @param {T} [options.or] - Value for the first slot on failure, Go's zero value
 * @returns {Result<T>} The Result
 */
function trapSync(fn, options = {}) {
  try {
    const value = fn()
    // A thenable here means trapSync() was handed an async function. The
    // sync door cannot await it, and returning ok:true with a pending
    // promise in the value slot would let the real rejection escape as an
    // unhandledRejection. Swallow the rejection so it cannot crash the
    // process, and report the API misuse, which is the actual bug.
    if (typeof value?.then === 'function') {
      value.then(undefined, () => {})
      throw new TypeError(
        'trapSync() received a function that returned a promise. Use trap(), which awaits.'
      )
    }
    return ok(value)
  } catch (error) {
    return fail(normalize(error), options.or)
  }
}

/**
 * Alias of trapSync()
 * @deprecated Use trapSync()
 * @template T
 * @param {() => T} fn - Function to execute
 * @returns {Result<T>} The Result
 */
function tryCatch(fn) {
  return trapSync(fn)
}

/**
 * Alias of trap()
 * @deprecated Use trap(), which is async for every kind of function
 * @template T
 * @param {() => Promise<T>} fn - Async function to execute
 * @returns {Promise<Result<T>>} Promise of a Result
 */
function tryCatchAsync(fn) {
  return trap(fn)
}

/**
 * Flattens any error-ish input into a plain array of errors.
 *
 * Accepts an AggregateError, an ErrorBoundary, an array, any iterable of
 * errors, or a single Error. Reads `errors` directly where present, so it
 * does not depend on the aggregate being iterable.
 * @param {unknown} input - The error, aggregate, boundary or collection
 * @returns {Error[]} Flat array of errors, empty if there are none
 */
function toErrorList(input) {
  if (input == null) return []
  if (Array.isArray(input)) return input
  if (typeof input !== 'object') return []
  if (Array.isArray(input.errors)) return input.errors
  // An ErrorBoundary exposes a copy via its `errors` getter, which the check
  // above already covers; this keeps non-array error-ish shapes out.

  if (typeof input[Symbol.iterator] === 'function') return [...input]
  return input instanceof Error ? [input] : []
}

/**
 * Groups errors by their `name`, for destructuring by type
 * @param {unknown} input - An AggregateError, boundary, array or iterable of errors
 * @returns {Record<string, Error[]>} Errors keyed by name, in encounter order
 * @example
 * const { TimeoutError = [], NotFoundError = [] } = errs.byName(aggregate)
 */
function byName(input) {
  // Object.create(null): an error named `constructor`, `toString` or
  // `hasOwnProperty` would otherwise collide with Object.prototype, where
  // `??=` sees a non-nullish inherited value and the push fails. It also
  // keeps destructuring defaults working for names that are absent.
  const grouped = Object.create(null)
  for (const error of toErrorList(input)) {
    const key = error?.name || 'Error'
    grouped[key] ??= []
    grouped[key].push(error)
  }
  return grouped
}

/**
 * Selects the errors that are instances of a given class.
 * The constructor-based counterpart to byName, and the analogue of Go's errors.As
 * @template {Error} E
 * @param {unknown} input - An AggregateError, boundary, array or iterable of errors
 * @param {new (...args: any[]) => E} ErrorClass - Class to match against
 * @returns {E[]} Matching errors, in encounter order
 */
function pick(input, ErrorClass) {
  return toErrorList(input).filter(error => error instanceof ErrorClass)
}

export default {
  registered,
  create,
  merge,
  handle,
  register,
  unregister,
  boundary,
  parallel,
  toJSON,
  format,
  isErrorType,
  isRegisteredType,
  assertErrorType,
  tryCatch,
  tryCatchAsync,
  trap,
  trapSync,
  group,
  byName,
  pick
}

export {
  registered,
  create,
  merge,
  handle,
  register,
  unregister,
  boundary,
  parallel,
  toJSON,
  format,
  isErrorType,
  isRegisteredType,
  assertErrorType,
  tryCatch,
  tryCatchAsync,
  trap,
  trapSync,
  group,
  byName,
  pick
}
