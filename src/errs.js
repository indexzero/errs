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

/**
 * An error read and written loosely.
 *
 * create() and merge() copy arbitrary metadata on and off errors, and `Error`
 * has no index signature for it.
 * @typedef {Error & Record<string, unknown>} LooseError
 */

/**
 * A registrable error constructor, matching the published ErrorTypeConstructor.
 *
 * `any[]` rather than `unknown[]`: parameters are contravariant, so an
 * `unknown[]` signature would reject every error subclass that declares a
 * typed constructor, which is all of them.
 * @template {Error} [E=Error]
 * @typedef {new (...args: any[]) => E} ErrorTypeConstructor
 */

/**
 * Everything byName() and pick() accept. Mirrors the ErrorInput union in
 * errs.d.ts; the conformance check in test/types compares the two.
 * Named structurally rather than as ErrorBoundary on purpose: a class with
 * private fields is nominally typed, so naming it here would make this
 * signature impossible to verify against the hand-written declaration. The
 * implementation only ever reads an `errors` array, so this is also the more
 * accurate description. An ErrorBoundary satisfies it through its getter.
 * @typedef {AggregateError|{errors: Error[]}|Iterable<Error>|Error[]|Error|null|undefined} ErrorInput
 */

/**
 * An options object for create(): `message` and `name` are read, and every own
 * property is copied onto the resulting error.
 *
 * The index signature is `any` rather than `unknown` so that an Error is
 * assignable here, which is what handle() relies on: an interface gets no
 * implicit index signature, and `Record<string, unknown>` would reject it.
 * @typedef {{ message?: string, name?: string, stack?: string } & Record<string, any>} CreateOptions
 */

/**
 * Everything create() accepts in its options slot: a message string, an array
 * of message parts, an options object, an Error to pass through, or a thunk
 * returning any of those.
 * @typedef {string|string[]|CreateOptions|(() => string|string[]|CreateOptions)|null} CreateInput
 */

/** @type {Record<string, ErrorTypeConstructor>} */
const registered = {}

/**
 * Looks up a registered error constructor.
 *
 * The key is `unknown` because create() takes its options in the type slot
 * when called with one argument: `create({ message })` arrives here with an
 * object, which misses the registry exactly as an unregistered name would.
 * @param {unknown} type - Candidate registered type name
 * @returns {ErrorTypeConstructor|undefined} The constructor, if one is registered
 */
function lookup(type) {
  return registered[/** @type {string} */ (type)]
}

/**
 * Creates a new error instance with the specified type and options.
 *
 * Two forms, declared as overloads so that `create(opts)` does not also
 * accept a second argument and `create(type, opts)` requires a string type.
 * The single implementation signature below is wider than either, because it
 * has to accept both shapes.
 * @overload
 * @param {string} [type] - Registered error type to create
 * @param {CreateInput} [opts] - Options for creating the error
 * @returns {Error} The created error
 */
/**
 * @overload
 * @param {CreateInput} [opts] - Options for creating the error, with no type
 * @returns {Error} The created error
 */
/**
 * @param {CreateInput} [type] - Registered error type, or the options
 *   themselves when that is the only argument
 * @param {CreateInput} [opts] - Options for creating the error
 * @returns {Error} The created error
 */
function create(type, opts) {
  if (opts === undefined && !lookup(type)) {
    opts = /** @type {CreateInput} */ (type)
    type = null
  }

  // An input that already carries a stack is an existing error, returned
  // untouched; nothing else here may assume the input has error properties.
  const existing = /** @type {LooseError} */ (opts)
  if (existing?.stack) {
    return existing
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

  // Whatever is left in `opts` is read as an options object from here on: the
  // string and array forms were folded into `message` above and replaced with
  // null, and a thunk was already called. The checker cannot follow that
  // through the switch, so one cast covers both reads below.
  const fields = /** @type {CreateOptions|null|undefined} */ (opts)

  const ErrorProto = (type && lookup(type)) || Error
  const error = /** @type {LooseError} */ (new ErrorProto(message))

  if (!error.name || error.name === 'Error') {
    error.name = fields?.name || ErrorProto.name || 'Error'
  }

  if (!error.stack) {
    Error.captureStackTrace?.(error, create)
    // @types/node declares captureStackTrace as always present, so a bare
    // truthiness check reads as a mistake to the checker; it is V8-only.
  } else if (typeof Error.captureStackTrace === 'function') {
    // V8 only - we understand the format
    const lines = error.stack.split('\n')
    if (lines[0]?.includes(error.message || '')) {
      lines.splice(1, 1)
      error.stack = lines.join('\n')
    }
  }

  if (fields) {
    Object.keys(fields).forEach(key => {
      error[key] = fields[key]
    })
  }

  return error
}

/**
 * Merges an existing error with a new error instance
 * @param {unknown} err - The error to merge, which need not be an Error
 * @param {CreateInput} [type] - Registered error type to create, or the options
 *   themselves when that is the last argument
 * @param {CreateInput} [opts] - Options for creating the error
 * @returns {Error} The merged error
 */
function merge(err, type, opts) {
  // The overloads on create() constrain external callers to either
  // (string, opts) or (opts); merge() forwards whatever it was given, which
  // is the wider implementation signature.
  const build = /** @type {(type?: CreateInput, opts?: CreateInput) => Error} */ (
    /** @type {unknown} */ (create)
  )
  const merged = /** @type {LooseError} */ (build(type, opts))

  if (err == null) {
    return merged
  }

  // merge() is given whatever was caught, so the source is read loosely: the
  // guard below is what decides which of these reads are meaningful.
  const source = /** @type {LooseError} */ (err)

  if (!Array.isArray(err) && typeof err === 'object') {
    Object.keys(source).forEach(key => {
      if (['stack', 'type', 'arguments', 'message'].indexOf(key) === -1) {
        merged[key] = source[key]
      }
    })
  }

  merged.name = merged.name || source.name
  merged.message = merged.message || source.message
  // Neither error need carry a stack, and writing the fallback back as
  // `undefined` is what this line has always done. Error's own declaration is
  // `stack?: string`, which exactOptionalPropertyTypes reads as "string, or
  // absent", so the write needs the cast.
  merged.stack = /** @type {string} */ (source.stack || merged.stack)

  // Set native cause chain
  if (err instanceof Error) {
    merged.cause = err
  }

  return merged
}

/**
 * Handles an error by invoking a callback or emitting on an EventEmitter
 * @param {Error|CreateInput} error - Error to handle
 * @param {((err: Error) => void)|EventEmitter} [callback] - Continuation or stream
 *   to pass the error to
 * @param {EventEmitter} [stream] - Explicit EventEmitter to use
 * @returns {EventEmitter|undefined} EventEmitter if no callback provided
 */
function handle(error, callback, stream) {
  error = create(error)

  if (typeof callback === 'function') {
    callback(/** @type {Error} */ (error))
  }

  if (typeof callback !== 'function' || stream) {
    // `callback` reaches the `||` chain below only when it is not a function,
    // or when `stream` was passed and wins it, so this is an EventEmitter.
    const emitter = /** @type {EventEmitter} */ (stream || callback || new EventEmitter())
    queueMicrotask(() => {
      emitter.emit('error', error)
    })
    return emitter
  }
}

/**
 * Registers an error type for future calls to create()
 *
 * Given a single argument, that argument is the constructor and the type name
 * is its own `name`, lowercased. Declared as overloads so that the
 * one-argument form does not also accept a stray second argument.
 * @overload
 * @param {string} type - Type name to register the error under
 * @param {ErrorTypeConstructor} proto - Constructor of the error to register
 * @returns {void}
 */
/**
 * @overload
 * @param {ErrorTypeConstructor} proto - Constructor, named by its own `name`
 * @returns {void}
 */
/**
 * @param {string|ErrorTypeConstructor} type - Type of the error to register, or the
 *   constructor itself in the one-argument form
 * @param {ErrorTypeConstructor} [proto] - Constructor function of the error to register
 * @returns {void}
 */
function register(type, proto) {
  if (arguments.length === 1) {
    proto = /** @type {ErrorTypeConstructor} */ (type)
    type = proto.name.toLowerCase()
  }
  registered[/** @type {string} */ (type)] = /** @type {ErrorTypeConstructor} */ (proto)
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
 * @template T
 * @param {Array<(signal: AbortSignal) => T|Promise<T>>|Promise<T>[]} tasks - Thunks or promises
 * @param {import('./group.js').ErrorGroupOptions} [options] - Options; `limit`,
 *   `signal` and `cancelOnError` apply to thunks only, and `boundary` collects
 *   into an existing boundary. Typed by the shape ErrorGroup and ErrorBoundary
 *   accept, because the options are forwarded to them verbatim.
 * @returns {Promise<{results: PromiseSettledResult<T>[], boundary: ErrorBoundary}>}
 *   Results and boundary
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

    // Cast per element: the group's results are Result<unknown>, and the
    // status strings need their literal types to form PromiseSettledResult.
    const results = errorGroup.results.map(result =>
      result.ok
        ? /** @type {PromiseFulfilledResult<T>} */ ({
            status: 'fulfilled',
            value: /** @type {T} */ (result.value)
          })
        : /** @type {PromiseRejectedResult} */ ({
            status: 'rejected',
            reason: result.error
          })
    )
    return { results, boundary: errorGroup.boundary }
  }

  if (thunks.length > 0) {
    // Attach a no-op handler to the promises that were already started before
    // refusing the call, so the argument error is what the caller sees rather
    // than an unrelated unhandledRejection crash a tick later.
    for (const task of list) {
      // Narrowed by hand: this branch is the mixed case, so a given entry may
      // be either a thunk or a promise, and only the promises need settling.
      const started = /** @type {Promise<unknown>} */ (task)
      if (typeof started?.then === 'function') started.then(undefined, () => {})
    }
    throw new TypeError(
      `parallel() takes either all thunks or all promises, got ${thunks.length} ` +
        `thunk(s) among ${list.length} tasks`
    )
  }

  warnAboutPromises()
  const results = /** @type {PromiseSettledResult<T>[]} */ (
    await Promise.allSettled(/** @type {Promise<T>[]} */ (list))
  )
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
 * @returns {Record<string, unknown>} JSON representation of the error
 */
function toJSON(error) {
  // serialize() returns its input verbatim for a non-object, which an Error
  // never is, so the top-level call always produces the object form.
  return /** @type {Record<string, unknown>} */ (serialize(error, new Set(), 0))
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
 * @param {number} depth - Current recursion depth
 * @returns {unknown} A JSON-safe representation
 */
function serialize(value, ancestors, depth) {
  if (depth > MAX_SERIALIZE_DEPTH) {
    return { truncated: true }
  }
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
      return error.map(entry => serialize(entry, ancestors, depth + 1))
    }

    /** @type {Record<string, unknown>} */
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
        obj[key] = serialize(error[key], ancestors, depth + 1)
      }
    }

    // `cause` and an AggregateError's `errors` are the two axes an error can
    // branch along, and both are non-enumerable when set by the constructor,
    // so the Object.keys() copy above misses them.
    if (error.cause != null) {
      obj.cause = serialize(error.cause, ancestors, depth + 1)
    }
    if (Array.isArray(error.errors)) {
      obj.errors = error.errors.map(nested => serialize(nested, ancestors, depth + 1))
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
    const thenable = /** @type {Promise<unknown>} */ (value)
    if (typeof thenable?.then === 'function') {
      thenable.then(undefined, () => {})
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

/** Depth cap for toJSON, matching the JSON formatter */
const MAX_SERIALIZE_DEPTH = 10

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

  // The input is some error-ish object, but `errors` is not declared on Error,
  // and nothing here may assume the value is iterable before it is checked.
  const collection = /** @type {{ errors?: unknown, [Symbol.iterator]?: unknown }} */ (input)

  if (Array.isArray(collection.errors)) return collection.errors
  // An ErrorBoundary exposes a copy via its `errors` getter, which the check
  // above already covers; this keeps non-array error-ish shapes out.

  if (typeof collection[Symbol.iterator] === 'function') {
    return [.../** @type {Iterable<Error>} */ (input)]
  }
  return input instanceof Error ? [input] : []
}

/**
 * Groups errors by their `name`, for destructuring by type
 * @param {ErrorInput} input - An AggregateError, boundary, array or iterable of errors
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
 *
 * The constructor-based counterpart to byName. Unlike Go's errors.As this is
 * shallow: it matches the listed errors themselves and does not walk their
 * cause chains.
 * @template {Error} E
 * @param {ErrorInput} input - An AggregateError, boundary, array or iterable of errors
 * @param {ErrorTypeConstructor<E>} ErrorClass - Class to match against
 * @returns {E[]} Matching errors, in encounter order
 */
function pick(input, ErrorClass) {
  return toErrorList(input).filter(
    /** @type {(error: Error) => error is E} */ (error => error instanceof ErrorClass)
  )
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
