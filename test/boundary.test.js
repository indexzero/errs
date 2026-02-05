/*
 * boundary.test.js: Tests for the ErrorBoundary class.
 *
 * (C) 2011-2025, Charlie Robbins, Nuno Job, and the Contributors.
 * MIT LICENSE
 *
 */

import { strict as assert } from 'node:assert'
import { describe, it } from 'node:test'
import { ErrorBoundary } from '../lib/boundary.js'

describe('ErrorBoundary', () => {
  describe('constructor', () => {
    it('creates boundary with default options', () => {
      const boundary = new ErrorBoundary()
      assert.equal(boundary.hasErrors(), false)
      assert.equal(boundary.count, 0)
    })

    it('respects maxErrors option', () => {
      const boundary = new ErrorBoundary({ maxErrors: 2 })
      boundary.add(new Error('1'))
      boundary.add(new Error('2'))
      boundary.add(new Error('3'))
      assert.equal(boundary.count, 2)
    })

    it('respects captureStack option', () => {
      const boundary = new ErrorBoundary({ captureStack: false })
      const aggregate = boundary.add(new Error('test')).toAggregateError()
      assert.equal(aggregate.cause, undefined)
    })
  })

  describe('add()', () => {
    it('adds Error instance', () => {
      const boundary = new ErrorBoundary()
      const err = new Error('test error')
      boundary.add(err)
      assert.equal(boundary.count, 1)
      assert.equal(boundary.errors[0], err)
    })

    it('converts non-Error to Error', () => {
      const boundary = new ErrorBoundary()
      boundary.add('string error')
      assert.equal(boundary.count, 1)
      assert(boundary.errors[0] instanceof Error)
      assert.equal(boundary.errors[0].message, 'string error')
    })

    it('returns boundary for chaining', () => {
      const boundary = new ErrorBoundary()
      const result = boundary.add(new Error('test'))
      assert.equal(result, boundary)
    })

    it('allows chaining multiple adds', () => {
      const boundary = new ErrorBoundary()
      boundary.add(new Error('1')).add(new Error('2')).add(new Error('3'))
      assert.equal(boundary.count, 3)
    })
  })

  describe('hasErrors()', () => {
    it('returns false when no errors', () => {
      const boundary = new ErrorBoundary()
      assert.equal(boundary.hasErrors(), false)
    })

    it('returns true when errors exist', () => {
      const boundary = new ErrorBoundary()
      boundary.add(new Error('test'))
      assert.equal(boundary.hasErrors(), true)
    })
  })

  describe('count', () => {
    it('returns 0 for empty boundary', () => {
      const boundary = new ErrorBoundary()
      assert.equal(boundary.count, 0)
    })

    it('returns correct count', () => {
      const boundary = new ErrorBoundary()
      boundary.add(new Error('1'))
      boundary.add(new Error('2'))
      assert.equal(boundary.count, 2)
    })
  })

  describe('errors', () => {
    it('returns copy of errors array', () => {
      const boundary = new ErrorBoundary()
      const err1 = new Error('1')
      const err2 = new Error('2')
      boundary.add(err1).add(err2)

      const errors = boundary.errors
      assert.equal(errors.length, 2)
      assert.equal(errors[0], err1)
      assert.equal(errors[1], err2)

      // Verify it's a copy
      errors.push(new Error('3'))
      assert.equal(boundary.count, 2)
    })
  })

  describe('toAggregateError()', () => {
    it('returns null when no errors', () => {
      const boundary = new ErrorBoundary()
      const aggregate = boundary.toAggregateError()
      assert.equal(aggregate, null)
    })

    it('creates AggregateError with default message', () => {
      const boundary = new ErrorBoundary()
      boundary.add(new Error('1'))
      boundary.add(new Error('2'))

      const aggregate = boundary.toAggregateError()
      assert(aggregate instanceof AggregateError)
      assert.equal(aggregate.message, 'Multiple errors occurred')
      assert.equal(aggregate.errors.length, 2)
    })

    it('creates AggregateError with custom message', () => {
      const boundary = new ErrorBoundary()
      boundary.add(new Error('1'))

      const aggregate = boundary.toAggregateError('Custom message')
      assert.equal(aggregate.message, 'Custom message')
    })

    it('includes boundary creation stack as cause', () => {
      const boundary = new ErrorBoundary({ captureStack: true })
      boundary.add(new Error('1'))

      const aggregate = boundary.toAggregateError()
      assert(aggregate.cause instanceof Error)
      assert.match(aggregate.cause.message, /ErrorBoundary created/)
    })
  })

  describe('throwIfErrors()', () => {
    it('does not throw when no errors', () => {
      const boundary = new ErrorBoundary()
      assert.doesNotThrow(() => {
        boundary.throwIfErrors()
      })
    })

    it('throws AggregateError when errors exist', () => {
      const boundary = new ErrorBoundary()
      boundary.add(new Error('1'))
      boundary.add(new Error('2'))

      assert.throws(() => {
        boundary.throwIfErrors()
      }, AggregateError)
    })

    it('throws with custom message', () => {
      const boundary = new ErrorBoundary()
      boundary.add(new Error('1'))

      try {
        boundary.throwIfErrors('Custom throw message')
        assert.fail('Should have thrown')
      } catch (err) {
        assert(err instanceof AggregateError)
        assert.equal(err.message, 'Custom throw message')
      }
    })
  })

  describe('clear()', () => {
    it('removes all errors', () => {
      const boundary = new ErrorBoundary()
      boundary.add(new Error('1'))
      boundary.add(new Error('2'))
      assert.equal(boundary.count, 2)

      boundary.clear()
      assert.equal(boundary.count, 0)
      assert.equal(boundary.hasErrors(), false)
    })

    it('returns boundary for chaining', () => {
      const boundary = new ErrorBoundary()
      boundary.add(new Error('1'))
      const result = boundary.clear()
      assert.equal(result, boundary)
    })

    it('allows reuse after clear', () => {
      const boundary = new ErrorBoundary()
      boundary.add(new Error('1'))
      boundary.clear()
      boundary.add(new Error('2'))
      assert.equal(boundary.count, 1)
    })
  })

  describe('use case: collecting validation errors', () => {
    it('collects multiple validation errors', () => {
      const boundary = new ErrorBoundary()
      const data = { email: 'invalid', age: -5, name: '' }

      if (!data.email.includes('@')) {
        boundary.add(new Error('Invalid email'))
      }
      if (data.age < 0) {
        boundary.add(new Error('Age must be positive'))
      }
      if (!data.name) {
        boundary.add(new Error('Name is required'))
      }

      assert.equal(boundary.count, 3)
      assert.throws(() => {
        boundary.throwIfErrors('Validation failed')
      }, AggregateError)
    })
  })

  describe('use case: parallel operations', () => {
    it('collects errors from async operations', async () => {
      const boundary = new ErrorBoundary()
      const operations = [
        () => Promise.resolve(1),
        () => Promise.reject(new Error('Op 2 failed')),
        () => Promise.resolve(3),
        () => Promise.reject(new Error('Op 4 failed'))
      ]

      const results = await Promise.allSettled(operations.map(op => op()))

      for (const result of results) {
        if (result.status === 'rejected') {
          boundary.add(result.reason)
        }
      }

      assert.equal(boundary.count, 2)
      assert.match(boundary.errors[0].message, /Op 2 failed/)
      assert.match(boundary.errors[1].message, /Op 4 failed/)
    })
  })

  describe('trap()', () => {
    it('returns ok result for successful function', () => {
      const boundary = new ErrorBoundary()
      const result = boundary.trap(() => 42)
      assert.equal(result.ok, true)
      assert.equal(result.value, 42)
      assert.equal(boundary.count, 0)
    })

    it('returns error result and adds to boundary on throw', () => {
      const boundary = new ErrorBoundary()
      const result = boundary.trap(() => {
        throw new Error('trap error')
      })
      assert.equal(result.ok, false)
      assert(result.error instanceof Error)
      assert.equal(result.error.message, 'trap error')
      assert.equal(boundary.count, 1)
      assert.equal(boundary.errors[0].message, 'trap error')
    })

    it('converts non-Error throws to Error', () => {
      const boundary = new ErrorBoundary()
      const result = boundary.trap(() => {
        throw 'string error'
      })
      assert.equal(result.ok, false)
      assert(result.error instanceof Error)
      assert.equal(result.error.message, 'string error')
      assert.equal(boundary.count, 1)
    })

    it('collects multiple errors from repeated traps', () => {
      const boundary = new ErrorBoundary()

      boundary.trap(() => {
        throw new Error('error 1')
      })
      boundary.trap(() => 'success')
      boundary.trap(() => {
        throw new Error('error 2')
      })

      assert.equal(boundary.count, 2)
      assert.equal(boundary.errors[0].message, 'error 1')
      assert.equal(boundary.errors[1].message, 'error 2')
    })
  })

  describe('trapAsync()', () => {
    it('returns ok result for successful async function', async () => {
      const boundary = new ErrorBoundary()
      const result = await boundary.trapAsync(async () => 42)
      assert.equal(result.ok, true)
      assert.equal(result.value, 42)
      assert.equal(boundary.count, 0)
    })

    it('returns error result and adds to boundary on rejection', async () => {
      const boundary = new ErrorBoundary()
      const result = await boundary.trapAsync(async () => {
        throw new Error('async trap error')
      })
      assert.equal(result.ok, false)
      assert(result.error instanceof Error)
      assert.equal(result.error.message, 'async trap error')
      assert.equal(boundary.count, 1)
      assert.equal(boundary.errors[0].message, 'async trap error')
    })

    it('converts non-Error rejections to Error', async () => {
      const boundary = new ErrorBoundary()
      const result = await boundary.trapAsync(async () => {
        throw 'string rejection'
      })
      assert.equal(result.ok, false)
      assert(result.error instanceof Error)
      assert.equal(result.error.message, 'string rejection')
      assert.equal(boundary.count, 1)
    })

    it('works with Promise-returning functions', async () => {
      const boundary = new ErrorBoundary()

      const good = await boundary.trapAsync(() => Promise.resolve(123))
      assert.equal(good.ok, true)
      assert.equal(good.value, 123)

      const bad = await boundary.trapAsync(() => Promise.reject(new Error('rejected')))
      assert.equal(bad.ok, false)
      assert.equal(bad.error.message, 'rejected')

      assert.equal(boundary.count, 1)
    })

    it('collects errors from parallel async traps', async () => {
      const boundary = new ErrorBoundary()

      await Promise.all([
        boundary.trapAsync(async () => {
          throw new Error('async 1')
        }),
        boundary.trapAsync(async () => 'success'),
        boundary.trapAsync(async () => {
          throw new Error('async 2')
        })
      ])

      assert.equal(boundary.count, 2)
    })
  })
})
