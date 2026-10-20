/**
 * The hybrid Result shape.
 *
 * An array of `[value, error]` that also carries `ok`, `value` and `error`
 * as non-enumerable properties, so all three readings work on one object:
 *
 * ```ts
 * const [user, err] = await errs.trap(() => fetchUser(1))
 * const { value, error } = await errs.trap(() => fetchUser(1))
 * const r = await errs.trap(() => fetchUser(1)); if (r.ok) use(r.value)
 * ```
 *
 * Order is value first, error last, following Go rather than Node's
 * error-first callback convention.
 */
export type Result<T, E extends Error = Error> =
  | ([T, undefined] & { ok: true; value: T; error: undefined })
  | ([T | undefined, E] & { ok: false; value: T | undefined; error: E })

/**
 * Options accepted by trap() and trapSync()
 */
export interface TrapOptions<T = unknown> {
  /**
   * Value for the first slot when the function throws, the analogue of
   * Go's zero value. Makes the value slot usable on the error branch
   * without changing `ok`.
   */
  or?: T
}

/**
 * Normalizes any thrown value into an Error
 * @param error - The thrown value
 * @returns The value if it is already an Error, else one wrapping it
 */
export function normalize(error: unknown): Error

/**
 * Builds a Result from its parts
 * @param ok - Whether the operation succeeded
 * @param value - The value, or the `or` fallback on failure
 * @param error - The error, if any
 */
export function result<T>(ok: boolean, value: T | undefined, error: Error | undefined): Result<T>

/**
 * A Result whose error, when present, is an iterable AggregateError
 */
export type AggregateResult<T> = Result<T, AggregateError & Iterable<Error>>

/**
 * Builds a successful Result
 * @param value - The value produced
 */
export function ok<T>(value: T): Result<T>

/**
 * Builds a failed Result
 * @param error - The error that occurred
 * @param fallback - Value for the first slot, from the `or` option
 */
export function fail<T>(error: Error, fallback?: T): Result<T>
