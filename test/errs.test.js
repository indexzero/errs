/*
 * errs.test.js: Tests for the `errs` module.
 *
 * (C) 2012, Charlie Robbins, Nuno Job, and the Contributors.
 * MIT LICENSE
 *
 */

import { describe, it } from 'node:test'
import { strict as assert } from 'node:assert'
import { EventEmitter } from 'node:events'
import errs from '../lib/errs.js'

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
  err.stack.split('\n').forEach(function (line) {
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
        const opts = { 'a-function': 'that returns an object', should: true, have: 4, properties: 'yes' }
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
    it('invokes callback with error', (t, done) => {
      const err = errs.create('Test error')
      errs.handle(err, (e) => {
        assert.equal(e, err)
        done()
      })
    })

    it('emits error on EventEmitter', (t, done) => {
      const err = errs.create('Some emitted error')
      const stream = new EventEmitter()
      stream.once('error', (e) => {
        assert.equal(e, err)
        done()
      })
      errs.handle(err, stream)
    })

    it('invokes callback and emits on stream', (t, done) => {
      const err = errs.create('Some emitted error')
      const stream = new EventEmitter()
      let invoked = 0

      function onError(e) {
        assert.equal(e, err)
        if (++invoked === 2) {
          done()
        }
      }

      stream.once('error', onError)
      errs.handle(err, onError, stream)
    })

    it('returns emitter when no callback provided', (t, done) => {
      const err = errs.create('Some emitted error')
      const emitter = errs.handle(err)
      emitter.once('error', (e) => {
        assert.equal(e, err)
        done()
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

      const successValues = results
        .filter(r => r.status === 'fulfilled')
        .map(r => r.value)

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
})
