/*
 * format.test.js: Tests for error formatting utilities.
 *
 * (C) 2011-2025, Charlie Robbins, Nuno Job, and the Contributors.
 * MIT LICENSE
 *
 */

import { describe, it } from 'node:test'
import { strict as assert } from 'node:assert'
import { format } from '../lib/format.js'

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
})
