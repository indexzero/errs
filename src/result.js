/*
 * result.js: The hybrid Result shape returned by trap(), trapSync() and group()
 *
 * (C) 2011-2025, Charlie Robbins, Nuno Job, and the Contributors.
 * MIT LICENSE
 *
 */

/**
 * The hybrid Result shape: an array of [value, error] that also carries
 * `ok`, `value` and `error` as non-enumerable properties.
 * @template T
 * @typedef {([T, undefined] & { ok: true, value: T, error: undefined }) | ([T|undefined, Error] & { ok: false, value: T|undefined, error: Error })} Result
 */

/**
 * Normalizes any thrown value into an Error.
 * DOMException is already an Error in every supported runtime, so aborts
 * and timeouts keep their `name` and pass through untouched.
 * @param {unknown} error - The thrown value
 * @returns {Error} The value if it is already an Error, else one wrapping it
 */
export function normalize(error) {
  if (error instanceof Error) return error

  // String() invokes toPrimitive, which throws on a null-prototype object and
  // on anything with a throwing toString. normalize() is called from inside
  // catch blocks, so throwing here escapes as an unhandled rejection and can
  // take the process down while reporting an error.
  let message
  try {
    message = String(error)
  } catch {
    message = Object.prototype.toString.call(error)
  }
  return new Error(message)
}

/**
 * Builds a Result: an array of [value, error] that also carries `ok`,
 * `value` and `error` as properties.
 *
 * Both readings work on one object, so `const [v, e] = r`, `const { value,
 * error } = r` and `if (r.ok)` are all valid. The named properties are
 * non-enumerable, so `Object.keys()` and `JSON.stringify()` see a plain
 * two-element array.
 * @template T
 * @param {boolean} ok - Whether the operation succeeded
 * @param {T|undefined} value - The value, or the `or` fallback on failure
 * @param {Error|undefined} error - The error, if any
 * @returns {Result<T>} The Result
 */
export function result(ok, value, error) {
  const tuple = [value, error]

  // defineProperties is only here for `enumerable: false`, which is the one
  // thing freeze cannot do: it keeps Object.keys() and JSON.stringify() seeing
  // a plain two-element array. Writability and configurability come from the
  // freeze below, so they are not restated here.
  Object.defineProperties(tuple, {
    ok: { value: ok, enumerable: false },
    value: { value, enumerable: false },
    error: { value: error, enumerable: false }
  })

  // The freeze is load-bearing, and not redundant with the above. The named
  // properties are locked by their descriptors, but the array indices and
  // `length` come from the literal and stay writable, so without this
  // `result[0] = x` succeeded while `.value` kept the old value and the two
  // readings disagreed.
  //
  // Note that copying a Result does NOT carry the named properties: spread,
  // structuredClone, Object.assign, Array.from and map/filter/concat all
  // produce a plain array. Read the properties off the Result itself.
  return /** @type {Result<T>} */ (Object.freeze(tuple))
}

/**
 * Builds a successful Result
 * @template T
 * @param {T} value - The value produced
 * @returns {Result<T>} A Result with ok true
 */
export function ok(value) {
  return result(true, value, undefined)
}

/**
 * Builds a failed Result
 * @template T
 * @param {Error} error - The error that occurred
 * @param {T} [fallback] - Value for the first slot, from the `or` option.
 *   This is the analogue of Go's zero value: it makes the value slot usable
 *   on the error branch without changing `ok`.
 * @returns {Result<T>} A Result with ok false
 */
export function fail(error, fallback) {
  return result(false, fallback, error)
}
