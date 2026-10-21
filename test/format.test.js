/*
 * format.test.js: Tests for error formatting utilities.
 *
 * (C) 2011-2025, Charlie Robbins, Nuno Job, and the Contributors.
 * MIT LICENSE
 *
 */

import { strict as assert } from 'node:assert'
import { describe, it } from 'node:test'
import { format } from '../src/format.js'

describe('format', () => {
  describe('terminal format', () => {
    it('formats simple error', () => {
      const err = new Error('Test error')
      const output = format(err, { format: 'terminal', colors: false })

      assert.match(output, /╭─ Error: Test error/)
      assert.match(output, /╰─ 1 error in chain/)
    })

    it('formats error with cause chain', () => {
      const cause = new Error('Original error')
      const err = new Error('Wrapped error', { cause })
      const output = format(err, { format: 'terminal', colors: false })

      assert.match(output, /╭─ Error: Wrapped error/)
      assert.match(output, /├─ Caused by: Error: Original error/)
      assert.match(output, /╰─ 2 errors in chain/)
    })

    it('includes stack trace lines', () => {
      const err = new Error('Test error')
      const output = format(err, { format: 'terminal', colors: false })

      assert.match(output, /│/)
      assert(output.includes('at'))
    })

    it('handles colors option', () => {
      const err = new Error('Test error')
      const outputNoColors = format(err, { format: 'terminal', colors: false })
      const outputWithColors = format(err, { format: 'terminal', colors: true })

      assert.equal(typeof outputNoColors, 'string')
      assert.equal(typeof outputWithColors, 'string')
    })
  })

  describe('terminal format with collected errors', () => {
    it("lists an AggregateError's collected errors", () => {
      const aggregate = new AggregateError(
        [new Error('first'), new TypeError('second')],
        'two failed'
      )
      const output = format(aggregate, { format: 'terminal', colors: false })

      assert.match(output, /├─ 2 errors collected:/)
      assert.match(output, /1\. Error: first/)
      assert.match(output, /2\. TypeError: second/)
      assert.match(output, /╰─ 1 error in chain, 2 collected/)
    })

    it('uses the singular for a lone collected error', () => {
      const output = format(new AggregateError([new Error('only')], 'one failed'), {
        format: 'terminal',
        colors: false
      })
      assert.match(output, /├─ 1 error collected:/)
      assert.match(output, /╰─ 1 error in chain, 1 collected/)
    })

    it('shows collected errors alongside a cause chain', () => {
      const aggregate = new AggregateError([new Error('a'), new Error('b')], 'failed')
      aggregate.cause = new Error('root')

      const output = format(aggregate, { format: 'terminal', colors: false })
      assert.match(output, /├─ 2 errors collected:/)
      assert.match(output, /├─ Caused by: Error: root/)
      assert.match(output, /╰─ 2 errors in chain, 2 collected/)
    })

    it('notes nested aggregates without expanding them', () => {
      const inner = new AggregateError([new Error('x'), new Error('y')], 'inner')
      const output = format(new AggregateError([inner, new Error('z')], 'outer'), {
        format: 'terminal',
        colors: false
      })

      assert.match(output, /1\. AggregateError: inner \(\+2 nested\)/)
      assert.match(output, /2\. Error: z/)
    })

    it('leaves the output of a plain error unchanged', () => {
      const output = format(new Error('solo'), { format: 'terminal', colors: false })
      assert.match(output, /╰─ 1 error in chain$/)
      assert.equal(output.includes('collected'), false)
    })

    it('renders an empty errors array as no collected section', () => {
      const output = format(new AggregateError([], 'none'), {
        format: 'terminal',
        colors: false
      })
      assert.equal(output.includes('collected'), false)
    })
  })

  describe('json format', () => {
    it('formats simple error', () => {
      const err = new Error('Test error')
      const output = format(err, { format: 'json', indent: 2 })
      const parsed = JSON.parse(output)

      assert.equal(parsed.name, 'Error')
      assert.equal(parsed.message, 'Test error')
      assert(Array.isArray(parsed.stack))
    })

    it('formats error with cause chain', () => {
      const cause = new Error('Original error')
      const err = new Error('Wrapped error', { cause })
      const output = format(err, { format: 'json' })
      const parsed = JSON.parse(output)

      assert.equal(parsed.message, 'Wrapped error')
      assert.equal(parsed.cause.message, 'Original error')
    })

    it('includes custom properties', () => {
      const err = new Error('Test error')
      err.code = 'CUSTOM_CODE'
      err.status = 500
      const output = format(err, { format: 'json' })
      const parsed = JSON.parse(output)

      assert.equal(parsed.code, 'CUSTOM_CODE')
      assert.equal(parsed.status, 500)
    })

    it('handles AggregateError', () => {
      const err1 = new Error('Error 1')
      const err2 = new Error('Error 2')
      const aggregate = new AggregateError([err1, err2], 'Multiple errors')
      const output = format(aggregate, { format: 'json' })
      const parsed = JSON.parse(output)

      assert.equal(parsed.message, 'Multiple errors')
      assert(Array.isArray(parsed.errors))
      assert.equal(parsed.errors.length, 2)
      assert.equal(parsed.errors[0].message, 'Error 1')
      assert.equal(parsed.errors[1].message, 'Error 2')
    })

    it('prevents circular references', () => {
      const err = new Error('Test error')
      err.self = err
      const output = format(err, { format: 'json' })
      const parsed = JSON.parse(output)

      assert.equal(parsed.self.circular, true)
    })

    it('respects depth limit', () => {
      let err = new Error('Level 0')
      for (let i = 1; i <= 15; i++) {
        err = new Error(`Level ${i}`, { cause: err })
      }
      const output = format(err, { format: 'json' })
      const parsed = JSON.parse(output)

      let depth = 0
      let current = parsed
      while (current.cause && !current.cause.truncated) {
        depth++
        current = current.cause
      }

      assert(depth <= 10)
    })
  })

  describe('html format', () => {
    it('formats simple error', () => {
      const err = new Error('Test error')
      const output = format(err, { format: 'html' })

      assert.match(output, /<div class="error-chain">/)
      assert.match(output, /<h3 class="error-name">Error<\/h3>/)
      assert.match(output, /<p class="error-message">Test error<\/p>/)
      assert.match(output, /<pre class="error-stack">/)
    })

    it('formats error with cause chain', () => {
      const cause = new Error('Original error')
      const err = new Error('Wrapped error', { cause })
      const output = format(err, { format: 'html' })

      assert.match(output, /Wrapped error/)
      assert.match(output, /Original error/)
      const errorDivs = output.match(/<div class="error">/g)
      assert.equal(errorDivs.length, 2)
    })

    it('escapes HTML characters', () => {
      const err = new Error('<script>alert("xss")</script>')
      const output = format(err, { format: 'html' })

      assert(output.includes('&lt;script&gt;'))
      assert(output.includes('&lt;/script&gt;'))
      assert(!output.includes('<script>alert'))
    })

    it('escapes ampersands', () => {
      const err = new Error('Error & problem')
      const output = format(err, { format: 'html' })

      assert(output.includes('Error &amp; problem'))
    })
  })

  describe('unknown format', () => {
    it('throws error for unknown format', () => {
      const err = new Error('Test error')

      assert.throws(() => {
        format(err, { format: 'unknown' })
      }, /Unknown format: unknown/)
    })
  })

  describe('default options', () => {
    it('uses terminal format by default', () => {
      const err = new Error('Test error')
      const output = format(err)

      assert.match(output, /╭─/)
      assert.match(output, /╰─/)
    })
  })
  describe('hostile inputs', () => {
    it('does not hang or crash on a circular cause', () => {
      const a = new Error('a')
      const b = new Error('b', { cause: a })
      a.cause = b

      for (const fmt of ['terminal', 'json', 'html']) {
        assert.doesNotThrow(() => format(a, { format: fmt, colors: false }))
      }
      assert.match(format(a, { format: 'terminal', colors: false }), /2 errors in chain/)
    })

    it('renders a non-Error cause', () => {
      const output = format(new Error('top', { cause: 'just a string' }), {
        format: 'terminal',
        colors: false
      })
      assert.match(output, /Caused by: just a string/)
    })

    it('renders aggregate members that are not Errors', () => {
      const aggregate = new AggregateError(
        [null, undefined, 'a string', 42, Object.create(null)],
        'mixed'
      )

      const output = format(aggregate, { format: 'terminal', colors: false })
      assert.match(output, /5 errors collected:/)
      assert.match(output, /1\. null/)
      assert.match(output, /2\. undefined/)
      assert.match(output, /3\. a string/)
      assert.match(output, /4\. 42/)
    })

    it('json format survives null and non-object members', () => {
      const parsed = JSON.parse(
        format(new AggregateError([null, 'str', 7], 'mixed'), { format: 'json' })
      )
      assert.deepEqual(parsed.errors, [null, 'str', 7])
    })

    it('json format treats a shared reference as shared, not circular', () => {
      const shared = new Error('shared')
      const parsed = JSON.parse(
        format(new AggregateError([shared, shared], 'two'), { format: 'json' })
      )
      assert.equal(parsed.errors[0].message, 'shared')
      assert.equal(parsed.errors[1].message, 'shared')
    })
  })
})
