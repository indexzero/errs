/*
 * errs.test.js: Tests for the `errs` module.
 *
 * (C) 2011-2025, Charlie Robbins, Nuno Job, and the Contributors.
 * MIT LICENSE
 *
 */

import { strict as assert } from 'node:assert'
import { EventEmitter } from 'node:events'
import { describe, it } from 'node:test'
import errs from '../src/errs.js'

class NamedError extends Error {
  name = 'NamedError'
  named = true
}

class AnError extends Error {
  name = 'AnError'
  named = true
}

function assertTransparentStack(err) {
  assert.equal(typeof err.stack, 'string')
  err.stack.split('\n').forEach(line => {
    assert.equal(/\/lib\/errs\.js:/.test(line), false)
  })
}

describe('errs', () => {
  describe('register()', () => {
    it('should register error type with name', () => {
      errs.register('named', NamedError)
      assert.equal(errs.registered.named, NamedError)
    })

    it('should register error type without providing name', () => {
      errs.register(AnError)
      assert.equal(errs.registered.anerror, AnError)
    })
  })

  describe('create()', () => {
    describe('with a string message', () => {
      it('creates error with correct message', () => {
        const err = errs.create('An error as a string')
        assert(err instanceof Error)
        assert.equal(err.message, 'An error as a string')
        assertTransparentStack(err)
      })
    })

    describe('with no parameters', () => {
      it('creates error with default message', () => {
        const err = errs.create()
        assert(err instanceof Error)
        assertTransparentStack(err)
      })
    })

    describe('with an object', () => {
      it('creates error with properties but no message', () => {
        const opts = { foo: 'bar', status: 404, whatever: 'some other property' }
        const err = errs.create(opts)
        assert(err instanceof Error)
        assert.equal(err.message, 'Unspecified error')
        assert.equal(err.foo, 'bar')
        assert.equal(err.status, 404)
        assert.equal(err.whatever, 'some other property')
        assertTransparentStack(err)
      })

      it('creates error with properties and message', () => {
        const opts = {
          testing: true,
          'some-string': 'is-a-value',
          message: 'This is an error. There are many like it.'
        }
        const err = errs.create(opts)
        assert(err instanceof Error)
        assert.equal(err.message, 'This is an error. There are many like it.')
        assert.equal(err.testing, true)
        assert.equal(err['some-string'], 'is-a-value')
        assertTransparentStack(err)
      })

      it('respects custom name in stack trace', () => {
        const err = errs.create({ name: 'OverflowError' })
        assert.match(err.stack, /^OverflowError/)
      })
    })

    describe('with an existing error', () => {
      it('returns error unmodified if has stack', () => {
        const original = new Error('An instance of an error')
        const result = errs.create(original)
        assert.equal(result, original)
      })
    })

    describe('with a function', () => {
      it('creates error from function result', () => {
        const opts = {
          'a-function': 'that returns an object',
          should: true,
          have: 4,
          properties: 'yes'
        }
        const fn = () => opts
        const err = errs.create(fn)
        assert(err instanceof Error)
        assert.equal(err['a-function'], 'that returns an object')
        assert.equal(err.should, true)
        assert.equal(err.have, 4)
        assert.equal(err.properties, 'yes')
        assertTransparentStack(err)
      })
    })

    describe('with a registered type', () => {
      it('creates error of registered type', () => {
        const err = errs.create('named', { message: 'test message' })
        assert(err instanceof NamedError)
        assert.equal(err.message, 'test message')
        assert.equal(err.named, true)
        assertTransparentStack(err)
      })

      it('creates generic error for unregistered type', () => {
        const err = errs.create('nonexistent', { message: 'test' })
        assert(err instanceof Error)
        assert.equal(err.message, 'test')
        assertTransparentStack(err)
      })
    })
  })

  describe('merge()', () => {
    it('handles undefined error', () => {
      const err = errs.merge(undefined, { message: 'oh noes!' })
      assert.equal(err.message, 'oh noes!')
      assert(err instanceof Error)
    })

    it('handles null error', () => {
      const err = errs.merge(null, { message: 'oh noes!' })
      assert.equal(err.message, 'oh noes!')
      assert(err instanceof Error)
    })

    it('handles false error', () => {
      const err = errs.merge(false, { message: 'oh noes!' })
      assert.equal(err.message, 'oh noes!')
      assert(err instanceof Error)
    })

    it('handles string error', () => {
      const err = errs.merge('wat', { message: 'oh noes!' })
      assert.equal(err.message, 'oh noes!')
      assert(err instanceof Error)
    })

    it('preserves custom properties from original', () => {
      const original = new Error('Msg!')
      original.foo = 'bar'
      const merged = errs.merge(original, { message: 'Override!', ns: 'test' })
      assert.equal(merged.foo, 'bar')
      assert.equal(merged.ns, 'test')
    })

    it('sets cause to original error', () => {
      const original = new Error('Original')
      const merged = errs.merge(original, { message: 'Wrapped' })
      assert.equal(merged.cause, original)
      assert.equal(merged.message, 'Wrapped')
    })

    it('preserves message specified in options', () => {
      const original = new Error('Msg!')
      const merged = errs.merge(original, { message: 'Override!' })
      assert.equal(merged.message, 'Override!')
    })

    it('preserves properties specified in options', () => {
      const original = new Error('Msg!')
      const merged = errs.merge(original, { ns: 'test' })
      assert.equal(merged.ns, 'test')
    })

    it('handles truthy value', () => {
      const merged = errs.merge(true, { message: 'Override!', ns: 'lolwut' })
      assert.equal(merged.message, 'Override!')
      assert.equal(merged.ns, 'lolwut')
    })

    it('handles object with truthy stack', () => {
      const merged = errs.merge({ stack: true }, { message: 'Override!', ns: 'lolwut' })
      assert.equal(merged.message, 'Override!')
      assert.equal(merged.ns, 'lolwut')
    })

    it('handles object with array stack', () => {
      const merged = errs.merge({ stack: [] }, { message: 'Override!', ns: 'lolwut' })
      assert.equal(merged.message, 'Override!')
      assert.equal(merged.ns, 'lolwut')
    })
  })

  describe('handle()', () => {
    it('invokes callback with error', async () => {
      const err = errs.create('Test error')
      await new Promise(resolve => {
        errs.handle(err, e => {
          assert.equal(e, err)
          resolve()
        })
      })
    })

    it('emits error on EventEmitter', async () => {
      const err = errs.create('Some emitted error')
      const stream = new EventEmitter()
      await new Promise(resolve => {
        stream.once('error', e => {
          assert.equal(e, err)
          resolve()
        })
        errs.handle(err, stream)
      })
    })

    it('invokes callback and emits on stream', async () => {
      const err = errs.create('Some emitted error')
      const stream = new EventEmitter()
      let invoked = 0

      await new Promise(resolve => {
        function onError(e) {
          assert.equal(e, err)
          if (++invoked === 2) {
            resolve()
          }
        }

        stream.once('error', onError)
        errs.handle(err, onError, stream)
      })
    })

    it('returns emitter when no callback provided', async () => {
      const err = errs.create('Some emitted error')
      const emitter = errs.handle(err)
      await new Promise(resolve => {
        emitter.once('error', e => {
          assert.equal(e, err)
          resolve()
        })
      })
    })
  })

  describe('unregister()', () => {
    it('unregisters error type', () => {
      errs.unregister('named')
      assert.equal(errs.registered.named, undefined)
      errs.unregister('anerror')
      assert.equal(errs.registered.anerror, undefined)
    })
  })

  describe('toJSON()', () => {
    it('converts error to JSON object', () => {
      const err = new Error('Testing 12345')
      err.customProp = 'custom value'
      const json = errs.toJSON(err)

      assert.equal(typeof json.message, 'string')
      assert.equal(typeof json.stack, 'string')
      assert.equal(json.customProp, 'custom value')
      assert.equal(json.name, 'Error')
    })

    it("includes an AggregateError's collected errors", () => {
      const boundary = errs.boundary({ captureStack: false })
      boundary.add(new Error('a'))
      boundary.add(new TypeError('b'))

      const json = errs.toJSON(boundary.toAggregateError('two failed'))

      assert.equal(json.errors.length, 2)
      assert.equal(json.errors[0].name, 'Error')
      assert.equal(json.errors[0].message, 'a')
      assert.equal(json.errors[1].name, 'TypeError')
    })

    it('includes a non-enumerable cause', () => {
      const error = new Error('outer', { cause: new Error('inner') })
      const json = errs.toJSON(error)

      assert.equal(json.cause.message, 'inner')
    })

    it('survives a circular cause', () => {
      const error = new Error('loop')
      error.cause = error

      const json = errs.toJSON(error)
      assert.equal(json.cause, '[Circular]')
      assert.doesNotThrow(() => JSON.stringify(json))
    })

    it('omits cause and errors when absent', () => {
      const json = errs.toJSON(new Error('plain'))
      assert.equal('cause' in json, false)
      assert.equal('errors' in json, false)
    })
  })

  describe('parallel()', () => {
    it('collects errors from rejected promises', async () => {
      const promises = [
        Promise.resolve(1),
        Promise.reject(new Error('Error 1')),
        Promise.resolve(2),
        Promise.reject(new Error('Error 2'))
      ]

      const { results, boundary } = await errs.parallel(promises)

      assert.equal(results.length, 4)
      assert.equal(boundary.count, 2)
      assert.equal(boundary.hasErrors(), true)

      const successValues = results.filter(r => r.status === 'fulfilled').map(r => r.value)

      assert.deepEqual(successValues, [1, 2])
    })
  })

  describe('boundary()', () => {
    it('creates an ErrorBoundary instance', () => {
      const boundary = errs.boundary()
      assert.equal(boundary.hasErrors(), false)
      assert.equal(boundary.count, 0)
    })
  })

  describe('isErrorType()', () => {
    it('returns true for matching error type', () => {
      const err = new TypeError('test')
      assert.equal(errs.isErrorType(err, TypeError), true)
    })

    it('returns false for non-matching error type', () => {
      const err = new TypeError('test')
      assert.equal(errs.isErrorType(err, RangeError), false)
    })

    it('returns false for non-error values', () => {
      assert.equal(errs.isErrorType('string', Error), false)
      assert.equal(errs.isErrorType(null, Error), false)
      assert.equal(errs.isErrorType(undefined, Error), false)
    })

    it('works with custom error classes', () => {
      class CustomError extends Error {
        name = 'CustomError'
      }
      const err = new CustomError('test')
      assert.equal(errs.isErrorType(err, CustomError), true)
      assert.equal(errs.isErrorType(err, Error), true)
      assert.equal(errs.isErrorType(err, TypeError), false)
    })
  })

  describe('isRegisteredType()', () => {
    it('returns true for registered error type', () => {
      class RegisteredError extends Error {
        name = 'RegisteredError'
      }
      errs.register('registered', RegisteredError)
      const err = new RegisteredError('test')
      assert.equal(errs.isRegisteredType(err, 'registered'), true)
      errs.unregister('registered')
    })

    it('returns false for unregistered type name', () => {
      const err = new Error('test')
      assert.equal(errs.isRegisteredType(err, 'nonexistent'), false)
    })

    it('returns false when error is wrong type', () => {
      class RegisteredError extends Error {
        name = 'RegisteredError'
      }
      errs.register('registered', RegisteredError)
      const err = new Error('test')
      assert.equal(errs.isRegisteredType(err, 'registered'), false)
      errs.unregister('registered')
    })
  })

  describe('assertErrorType()', () => {
    it('returns error when type matches', () => {
      const err = new TypeError('test')
      const result = errs.assertErrorType(err, TypeError)
      assert.equal(result, err)
    })

    it('throws TypeError when type does not match', () => {
      const err = new RangeError('test')
      assert.throws(() => {
        errs.assertErrorType(err, TypeError)
      }, TypeError)
    })

    it('throws with default message', () => {
      const err = new RangeError('test')
      try {
        errs.assertErrorType(err, TypeError)
        assert.fail('Should have thrown')
      } catch (e) {
        assert.match(e.message, /Expected TypeError, got RangeError/)
      }
    })

    it('throws with custom message', () => {
      const err = new RangeError('test')
      try {
        errs.assertErrorType(err, TypeError, 'Custom assertion message')
        assert.fail('Should have thrown')
      } catch (e) {
        assert.equal(e.message, 'Custom assertion message')
      }
    })

    it('handles non-error values', () => {
      try {
        errs.assertErrorType('not an error', TypeError)
        assert.fail('Should have thrown')
      } catch (e) {
        assert(e instanceof TypeError)
      }
    })
  })

  describe('tryCatch()', () => {
    it('returns ok result for successful function', () => {
      const result = errs.tryCatch(() => 42)
      assert.equal(result.ok, true)
      assert.equal(result.value, 42)
    })

    it('returns error result for throwing function', () => {
      const result = errs.tryCatch(() => {
        throw new Error('test error')
      })
      assert.equal(result.ok, false)
      assert(result.error instanceof Error)
      assert.equal(result.error.message, 'test error')
    })

    it('converts non-Error throws to Error', () => {
      const result = errs.tryCatch(() => {
        throw 'string error'
      })
      assert.equal(result.ok, false)
      assert(result.error instanceof Error)
      assert.equal(result.error.message, 'string error')
    })

    it('works with JSON.parse', () => {
      const good = errs.tryCatch(() => JSON.parse('{"a":1}'))
      assert.equal(good.ok, true)
      assert.deepEqual(good.value, { a: 1 })

      const bad = errs.tryCatch(() => JSON.parse('not json'))
      assert.equal(bad.ok, false)
      assert(bad.error instanceof SyntaxError)
    })
  })

  describe('tryCatchAsync()', () => {
    it('returns ok result for successful async function', async () => {
      const result = await errs.tryCatchAsync(async () => {
        return 42
      })
      assert.equal(result.ok, true)
      assert.equal(result.value, 42)
    })

    it('returns error result for rejecting function', async () => {
      const result = await errs.tryCatchAsync(async () => {
        throw new Error('async error')
      })
      assert.equal(result.ok, false)
      assert(result.error instanceof Error)
      assert.equal(result.error.message, 'async error')
    })

    it('converts non-Error rejections to Error', async () => {
      const result = await errs.tryCatchAsync(async () => {
        throw 'string rejection'
      })
      assert.equal(result.ok, false)
      assert(result.error instanceof Error)
      assert.equal(result.error.message, 'string rejection')
    })

    it('works with Promise-returning functions', async () => {
      const good = await errs.tryCatchAsync(() => Promise.resolve(123))
      assert.equal(good.ok, true)
      assert.equal(good.value, 123)

      const bad = await errs.tryCatchAsync(() => Promise.reject(new Error('rejected')))
      assert.equal(bad.ok, false)
      assert.equal(bad.error.message, 'rejected')
    })
  })
  describe('byName()', () => {
    class TimeoutError extends Error {
      name = 'TimeoutError'
    }

    const mixed = () => {
      const b = errs.boundary()
      b.add(new TimeoutError('slow one'))
      b.add(new Error('plain'))
      b.add(new TimeoutError('slow two'))
      return b.toAggregateError()
    }

    it('groups an AggregateError by error name', () => {
      const { TimeoutError: timeouts = [], Error: plain = [] } = errs.byName(mixed())
      assert.equal(timeouts.length, 2)
      assert.equal(plain.length, 1)
      assert.deepEqual(
        timeouts.map(e => e.message),
        ['slow one', 'slow two']
      )
    })

    it('destructures missing names to the supplied default', () => {
      const { NotFoundError = [] } = errs.byName(mixed())
      assert.deepEqual(NotFoundError, [])
    })

    it('accepts a plain array of errors', () => {
      const grouped = errs.byName([new TimeoutError('a'), new Error('b')])
      assert.equal(grouped.TimeoutError.length, 1)
      assert.equal(grouped.Error.length, 1)
    })

    it('accepts a single error', () => {
      assert.equal(errs.byName(new TimeoutError('solo')).TimeoutError.length, 1)
    })

    it('does not depend on the aggregate being iterable', () => {
      const bare = new AggregateError([new TimeoutError('a')], 'bare')
      assert.equal(typeof bare[Symbol.iterator], 'undefined')
      assert.equal(errs.byName(bare).TimeoutError.length, 1)
    })

    it('returns an empty record for empty and non-error input', () => {
      for (const input of [null, undefined, [], 'not an error', 42]) {
        assert.deepEqual(Object.keys(errs.byName(input)), [])
      }
    })

    it('uses a null-prototype record so prototype names cannot collide', () => {
      const grouped = errs.byName([
        Object.assign(new Error('a'), { name: 'constructor' }),
        Object.assign(new Error('b'), { name: 'hasOwnProperty' }),
        Object.assign(new Error('c'), { name: 'toString' })
      ])

      assert.equal(Object.getPrototypeOf(grouped), null)
      assert.equal(grouped.constructor.length, 1)
      assert.equal(grouped.hasOwnProperty.length, 1)
      assert.equal(grouped.toString.length, 1)

      // Destructuring defaults still work for an absent name
      const { NotPresent = [] } = errs.byName([new Error('x')])
      assert.deepEqual(NotPresent, [])
    })

    it('falls back to Error for a nameless error', () => {
      const nameless = new Error('x')
      nameless.name = ''
      assert.equal(errs.byName([nameless]).Error.length, 1)
    })
  })

  describe('pick()', () => {
    class TimeoutError extends Error {
      name = 'TimeoutError'
    }
    class NotFoundError extends Error {
      name = 'NotFoundError'
    }

    const mixed = () => {
      const b = errs.boundary()
      b.add(new TimeoutError('slow'))
      b.add(new NotFoundError('gone'))
      b.add(new Error('plain'))
      return b.toAggregateError()
    }

    it('selects by constructor', () => {
      assert.equal(errs.pick(mixed(), TimeoutError).length, 1)
      assert.equal(errs.pick(mixed(), NotFoundError).length, 1)
    })

    it('matches subclasses, since it uses instanceof', () => {
      assert.equal(errs.pick(mixed(), Error).length, 3)
    })

    it('returns an empty array when nothing matches', () => {
      class Unused extends Error {}
      assert.deepEqual(errs.pick(mixed(), Unused), [])
    })

    it('returns an empty array for empty input', () => {
      assert.deepEqual(errs.pick(null, Error), [])
    })
  })
  describe('trap()', () => {
    it('returns a Result for a sync, async or promise-returning function', async () => {
      assert.equal((await errs.trap(() => 1))[0], 1)
      assert.equal((await errs.trap(async () => 2))[0], 2)
      assert.equal((await errs.trap(() => Promise.resolve(3)))[0], 3)
    })

    it('traps a throw without any boundary', async () => {
      const [value, error] = await errs.trap(() => {
        throw new Error('free-standing')
      })
      assert.equal(value, undefined)
      assert.equal(error.message, 'free-standing')
    })

    it('is always async, so a forgotten await destructures loudly', () => {
      assert.throws(
        () => {
          // biome-ignore lint/plugin: destructuring the array is the behaviour under test
          const [value] = errs.trap(() => 1)
          return value
        },
        { name: 'TypeError' }
      )
    })

    it('honours or on failure', async () => {
      const [value, error] = await errs.trap(
        () => {
          throw new Error('bad')
        },
        { or: 'zero' }
      )
      assert.equal(value, 'zero')
      assert.equal(error.message, 'bad')
    })
  })

  describe('trapSync()', () => {
    it('returns a Result directly', () => {
      const [value, error] = errs.trapSync(() => 'now')
      assert.equal(value, 'now')
      assert.equal(error, undefined)
    })

    it('traps a throw and normalizes it', () => {
      const [, error] = errs.trapSync(() => {
        throw 'not an error'
      })
      assert(error instanceof Error)
      assert.equal(error.message, 'not an error')
    })
  })

  describe('deprecated aliases', () => {
    it('tryCatch delegates to trapSync', () => {
      const result = errs.tryCatch(() => 5)
      assert.equal(result.ok, true)
      assert.equal(result.value, 5)
      assert.equal(result[0], 5)
    })

    it('tryCatchAsync delegates to trap', async () => {
      const result = await errs.tryCatchAsync(async () => 6)
      assert.equal(result.ok, true)
      assert.equal(result[0], 6)
    })
  })

  describe('group()', () => {
    it('creates a group that collects failures', async () => {
      const group = errs.group({ limit: 2 })
      group.run(async () => 'a')
      group.run(async () => {
        throw new Error('b failed')
      })

      const [values, error] = await group.wait()
      assert.equal(values, undefined)
      assert.deepEqual(
        [...error].map(e => e.message),
        ['b failed']
      )
      assert.equal(group.boundary.count, 1)
    })

    it('byName and pick work on the group error', async () => {
      class SlowError extends Error {
        name = 'SlowError'
      }

      const group = errs.group()
      group.run(async () => {
        throw new SlowError('too slow')
      })
      group.run(async () => {
        throw new Error('plain')
      })

      const [, error] = await group.wait()
      const { SlowError: slow = [] } = errs.byName(error)
      assert.equal(slow.length, 1)
      assert.equal(errs.pick(error, SlowError).length, 1)
    })
  })

  describe('parallel() with thunks', () => {
    it('launches thunks and reports settled results', async () => {
      const { results, boundary } = await errs.parallel([
        () => Promise.resolve('a'),
        () => Promise.reject(new Error('b failed'))
      ])

      assert.deepEqual(
        results.map(result => result.status),
        ['fulfilled', 'rejected']
      )
      assert.equal(results[0].value, 'a')
      assert.equal(results[1].reason.message, 'b failed')
      assert.equal(boundary.count, 1)
    })

    it('applies limit, which promises could never support', async () => {
      let active = 0
      let peak = 0
      const task = async () => {
        active += 1
        peak = Math.max(peak, active)
        await new Promise(resolve => setTimeout(resolve, 10))
        active -= 1
      }

      await errs.parallel([task, task, task, task], { limit: 2 })
      assert.equal(peak, 2)
    })

    it('applies a cancellation signal', async () => {
      const controller = new AbortController()
      setTimeout(() => controller.abort(new Error('stop')), 5)

      const { boundary } = await errs.parallel(
        [
          signal =>
            new Promise((resolve, reject) => {
              const timer = setTimeout(resolve, 1000)
              signal.addEventListener('abort', () => {
                clearTimeout(timer)
                reject(signal.reason)
              })
            })
        ],
        { signal: controller.signal }
      )

      assert.equal(boundary.count, 1)
      assert.equal(boundary.errors[0].message, 'stop')
    })

    it('still accepts started promises for v1 compatibility', async () => {
      const { results, boundary } = await errs.parallel([
        Promise.resolve(1),
        Promise.reject(new Error('old style'))
      ])

      assert.deepEqual(
        results.map(result => result.status),
        ['fulfilled', 'rejected']
      )
      assert.equal(boundary.count, 1)
    })

    it('treats an empty list as thunks, with no warning and no results', async () => {
      const { results, boundary } = await errs.parallel([])
      assert.deepEqual(results, [])
      assert.equal(boundary.count, 0)
    })

    it('refuses a mix of thunks and promises', async () => {
      await assert.rejects(() => errs.parallel([() => 1, Promise.resolve(2)]), {
        name: 'TypeError'
      })
    })
  })
  describe('review regressions', () => {
    it('toJSON works as a bare callback', () => {
      // A `seen` parameter in the public signature made Array#map pass the
      // index as the cycle guard.
      const json = [new Error('one'), new Error('two')].map(errs.toJSON)
      assert.equal(json.length, 2)
      assert.equal(json[0].message, 'one')
      assert.equal(Array.from([new Error('x')], errs.toJSON)[0].message, 'x')
    })

    it('toJSON treats a shared reference as shared, not circular', () => {
      const root = new Error('root')
      const shared = new Error('abort', { cause: root })
      const aggregate = new AggregateError([root, shared, shared], 'three')

      const json = errs.toJSON(aggregate)

      assert.equal(json.errors.length, 3)
      assert.equal(json.errors[1].name, 'Error')
      assert.equal(json.errors[2].message, 'abort')
      assert.equal(json.errors[1].cause.message, 'root')
    })

    it('toJSON output is always JSON-serializable', () => {
      const aggregate = new AggregateError([], 'cyclic')
      aggregate.errors.push(aggregate.errors)
      assert.doesNotThrow(() => JSON.stringify(errs.toJSON(aggregate)))

      const withMeta = new Error('meta')
      withMeta.meta = {}
      withMeta.meta.self = withMeta.meta
      assert.doesNotThrow(() => JSON.stringify(errs.toJSON(withMeta)))
    })

    it('normalize does not throw on a value whose String() throws', async () => {
      const hostile = {
        toString() {
          throw new Error('hostile toString')
        }
      }

      const [, error] = await errs.trap(() => {
        throw hostile
      })
      assert(error instanceof Error)

      const nullProto = Object.create(null)
      const [, error2] = errs.trapSync(() => {
        throw nullProto
      })
      assert(error2 instanceof Error)
    })

    it('trapSync refuses an async function instead of leaking the rejection', () => {
      const [value, error] = errs.trapSync(async () => {
        throw new Error('would escape')
      })

      assert.equal(value, undefined)
      assert(error instanceof TypeError)
      assert.match(error.message, /Use trap\(\)/)
    })

    it('toJSON caps recursion depth like the JSON formatter', () => {
      let deep = new Error('leaf')
      for (let i = 0; i < 40; i += 1) deep = new Error(`wrap ${i}`, { cause: deep })

      let node = errs.toJSON(deep)
      let depth = 0
      while (node?.cause) {
        node = node.cause
        depth += 1
      }

      assert.equal(depth, 11)
      assert.deepEqual(node, { truncated: true })
    })

    it('parallel does not orphan started promises when refusing mixed input', async () => {
      const rejected = Promise.reject(new Error('orphaned'))
      await assert.rejects(() => errs.parallel([() => 1, rejected]), { name: 'TypeError' })

      // If the rejection were unobserved this would be an unhandledRejection
      await new Promise(resolve => setTimeout(resolve, 10))
      await assert.rejects(() => rejected, { message: 'orphaned' })
    })
  })
})
