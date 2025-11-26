/*
 * errs.js: Simple error creation and passing utilities.
 *
 * (C) 2012, Charlie Robbins, Nuno Job, and the Contributors.
 * MIT LICENSE
 *
 */

import { EventEmitter } from 'node:events'
import { ErrorBoundary } from './boundary.js'
import { format } from './format.js'

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

  if (opts && opts.stack) {
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
        message = (opts && opts.message) || 'Unspecified error'
        break
      default:
        message = 'Unspecified error'
        break
    }
  }

  const ErrorProto = type && registered[type] || Error
  const error = new ErrorProto(message)

  if (!error.name || error.name === 'Error') {
    error.name = (opts && opts.name) || ErrorProto.name || 'Error'
  }

  if (!error.stack) {
    Error.call(error)
    Error.captureStackTrace(error, create)
  } else {
    error.stack = error.stack.split('\n')
    error.stack.splice(1, 1)
    error.stack = error.stack.join('\n')
  }

  if (opts) {
    Object.keys(opts).forEach(function (key) {
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

  if (err == undefined || err == null) {
    return merged
  }

  if (!Array.isArray(err) && typeof err === 'object') {
    Object.keys(err).forEach(function (key) {
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
    process.nextTick(function () { emitter.emit('error', error) })
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
 * Runs multiple promises in parallel and collects errors
 * @param {Promise[]} promises - Array of promises to run
 * @param {object} [options] - Options including optional boundary
 * @returns {Promise<{results: Array, boundary: ErrorBoundary}>} Results and boundary
 */
async function parallel(promises, options = {}) {
  const results = await Promise.allSettled(promises)
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
  const obj = {
    message: error.message,
    stack: error.stack,
    arguments: error.arguments,
    type: error.type
  }

  for (const key of Object.keys(error)) {
    if (!(key in obj)) {
      obj[key] = error[key]
    }
  }

  return obj
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
  format
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
  format
}
