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
 * @typedef {[T|undefined, Error|undefined] & ({ ok: true, value: T, error: undefined } | { ok: false, value: T|undefined, error: Error })} Result
 */

/**
 * Normalizes any thrown value into an Error.
 * DOMException is already an Error in every supported runtime, so aborts
 * and timeouts keep their `name` and pass through untouched.
 * @param {unknown} error - The thrown value
 * @returns {Error} The value if it is already an Error, else one wrapping it
 */
export function normalize(error) {
  return error instanceof Error ? error : new Error(String(error))
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
  Object.defineProperties(tuple, {
    ok: { value: ok, enumerable: false, configurable: true },
    value: { value, enumerable: false, configurable: true },
    error: { value: error, enumerable: false, configurable: true }
  })
  return /** @type {Result<T>} */ (tuple)
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
