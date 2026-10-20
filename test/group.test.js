/*
 * group.test.js: Tests for ErrorGroup.
 *
 * (C) 2011-2025, Charlie Robbins, Nuno Job, and the Contributors.
 * MIT LICENSE
 *
 */

import { strict as assert } from 'node:assert'
import { describe, it } from 'node:test'
import { ErrorBoundary } from '../src/boundary.js'
import { ErrorGroup } from '../src/group.js'

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))

/**
 * A thunk that honours the group signal, so cancellation is observable
 */
const cancellable = (ms, value) => signal =>
  new Promise((resolve, reject) => {
    const timer = setTimeout(() => resolve(value), ms)
    signal.addEventListener('abort', () => {
      clearTimeout(timer)
      reject(signal.reason)
    })
  })

describe('ErrorGroup', () => {
  describe('constructor', () => {
    it('rejects a limit below 1', () => {
      assert.throws(() => new ErrorGroup({ limit: 0 }), { name: 'RangeError' })
      assert.throws(() => new ErrorGroup({ limit: -1 }), { name: 'RangeError' })
    })

    it('accepts a caller-supplied boundary', async () => {
      const boundary = new ErrorBoundary()
      const group = new ErrorGroup({ boundary })
      group.run(() => {
        throw new Error('boom')
      })
      await group.wait()
      assert.equal(boundary.count, 1)
      assert.equal(group.boundary, boundary)
    })

    it('starts already aborted when given an aborted signal', async () => {
      const controller = new AbortController()
      controller.abort(new Error('too late'))
      const group = new ErrorGroup({ signal: controller.signal })

      let ran = false
      group.run(() => {
        ran = true
      })
      const [, error] = await group.wait()

      assert.equal(ran, false)
      assert.equal(group.signal.aborted, true)
      assert.equal(error.errors[0].message, 'too late')
    })
  })

  describe('wait()', () => {
    it('resolves to every value in run order', async () => {
      const group = new ErrorGroup()
      group.run(async () => 'a')
      group.run(async () => 'b')
      group.run(() => 'c')

      const [values, error] = await group.wait()
      assert.deepEqual(values, ['a', 'b', 'c'])
      assert.equal(error, undefined)
    })

    it('preserves run order even when tasks finish out of order', async () => {
      const group = new ErrorGroup()
      group.run(async () => {
        await sleep(30)
        return 'slow'
      })
      group.run(async () => 'fast')

      const [values] = await group.wait()
      assert.deepEqual(values, ['slow', 'fast'])
    })

    it('resolves to an empty array for an empty group', async () => {
      const [values, error] = await new ErrorGroup().wait()
      assert.deepEqual(values, [])
      assert.equal(error, undefined)
    })

    it('leaves the value slot undefined when anything failed', async () => {
      const group = new ErrorGroup()
      group.run(async () => 'ok')
      group.run(async () => {
        throw new Error('bad')
      })

      const [values, error] = await group.wait()
      assert.equal(values, undefined)
      assert(error instanceof AggregateError)
    })

    it('collects every failure into one iterable AggregateError', async () => {
      const group = new ErrorGroup()
      group.run(async () => {
        throw new Error('one')
      })
      group.run(async () => {
        throw new Error('two')
      })

      const [, error] = await group.wait()
      assert.deepEqual(
        [...error].map(e => e.message),
        ['one', 'two']
      )
      assert.match(error.message, /2 of 2 tasks failed/)
    })

    it('counts in the singular for a lone failure', async () => {
      const group = new ErrorGroup()
      group.run(async () => 'fine')
      group.run(async () => {
        throw new Error('only')
      })

      const [, error] = await group.wait()
      assert.match(error.message, /1 of 2 task failed/)
    })

    it('normalizes a non-Error throw', async () => {
      const group = new ErrorGroup()
      group.run(async () => {
        throw 'a string'
      })

      const [, error] = await group.wait()
      assert(error.errors[0] instanceof Error)
      assert.equal(error.errors[0].message, 'a string')
    })

    it('waits for tasks a running task adds to the group', async () => {
      const group = new ErrorGroup()
      group.run(async () => {
        await sleep(5)
        group.run(async () => 'nested')
        return 'outer'
      })

      const [values] = await group.wait()
      assert.deepEqual(values, ['outer', 'nested'])
    })
  })

  describe('results', () => {
    it('exposes per-task Results in run order for partial recovery', async () => {
      const group = new ErrorGroup()
      group.run(async () => 1)
      group.run(async () => {
        throw new Error('middle')
      })
      group.run(async () => 3)

      await group.wait()

      assert.equal(group.results.length, 3)
      assert.deepEqual(
        group.results.filter(result => result.ok).map(result => result.value),
        [1, 3]
      )
      assert.equal(group.results[1].ok, false)
      assert.equal(group.results[1].error.message, 'middle')
    })

    it('returns a copy', async () => {
      const group = new ErrorGroup()
      group.run(async () => 1)
      await group.wait()

      group.results.push('nonsense')
      assert.equal(group.results.length, 1)
    })

    it('reports size as the number of tasks handed over', () => {
      const group = new ErrorGroup()
      group.run(async () => 1).run(async () => 2)
      assert.equal(group.size, 2)
    })
  })

  describe('limit', () => {
    it('never exceeds the limit', async () => {
      let active = 0
      let peak = 0
      const group = new ErrorGroup({ limit: 2 })

      for (let i = 0; i < 8; i += 1) {
        group.run(async () => {
          active += 1
          peak = Math.max(peak, active)
          await sleep(10)
          active -= 1
        })
      }

      await group.wait()
      assert.equal(peak, 2)
      assert.equal(active, 0)
    })

    it('hands a freed slot straight to the next waiter', async () => {
      // Regression guard: releasing by decrement and re-acquiring by
      // increment lets a task added later slip past the limit.
      let active = 0
      let peak = 0
      const group = new ErrorGroup({ limit: 1 })

      const task = async () => {
        active += 1
        peak = Math.max(peak, active)
        await sleep(5)
        active -= 1
      }

      group.run(task)
      group.run(task)
      await sleep(7)
      group.run(task)

      await group.wait()
      assert.equal(peak, 1)
    })

    it('still releases its slot when a task throws', async () => {
      let peak = 0
      let active = 0
      const group = new ErrorGroup({ limit: 1 })

      for (let i = 0; i < 4; i += 1) {
        group.run(async () => {
          active += 1
          peak = Math.max(peak, active)
          await sleep(2)
          active -= 1
          throw new Error(`fail ${i}`)
        })
      }

      const [, error] = await group.wait()
      assert.equal(peak, 1)
      assert.equal([...error].length, 4)
    })

    it('runs everything at once with no limit', async () => {
      let active = 0
      let peak = 0
      const group = new ErrorGroup()

      for (let i = 0; i < 5; i += 1) {
        group.run(async () => {
          active += 1
          peak = Math.max(peak, active)
          await sleep(10)
          active -= 1
        })
      }

      await group.wait()
      assert.equal(peak, 5)
    })
  })

  describe('cancelOnError', () => {
    it('aborts the siblings on first failure', async () => {
      const group = new ErrorGroup({ cancelOnError: true })
      group.run(async () => {
        await sleep(5)
        throw new Error('fast-fail')
      })
      group.run(cancellable(1000, 'slow-a'))
      group.run(cancellable(1000, 'slow-b'))

      const started = Date.now()
      const [, error] = await group.wait()

      assert.equal(group.signal.aborted, true)
      assert(Date.now() - started < 500, 'should not have waited for the siblings')
      assert.equal([...error].length, 3)
    })

    it('aborts with an AbortError whose cause is the original failure', async () => {
      const group = new ErrorGroup({ cancelOnError: true })
      group.run(async () => {
        throw new Error('root cause')
      })
      group.run(cancellable(1000, 'sibling'))

      const [, error] = await group.wait()
      const aborts = [...error].filter(e => e.name === 'AbortError')

      assert.equal(aborts.length, 1)
      assert.match(aborts[0].message, /group cancelled: root cause/)
      assert.equal(aborts[0].cause.message, 'root cause')
    })

    it('does not abort when cancelOnError is off', async () => {
      const group = new ErrorGroup()
      group.run(async () => {
        throw new Error('ignored')
      })
      group.run(async () => 'finished')

      const [, error] = await group.wait()
      assert.equal(group.signal.aborted, false)
      assert.equal([...error].length, 1)
      assert.equal(group.results[1].value, 'finished')
    })

    it('skips tasks that had not started yet', async () => {
      let started = 0
      const group = new ErrorGroup({ limit: 1, cancelOnError: true })

      group.run(async () => {
        started += 1
        throw new Error('first')
      })
      group.run(async () => {
        started += 1
      })
      group.run(async () => {
        started += 1
      })

      await group.wait()
      assert.equal(started, 1)
    })
  })

  describe('signal', () => {
    it('aborts the group when an external signal aborts', async () => {
      const controller = new AbortController()
      const group = new ErrorGroup({ signal: controller.signal })
      group.run(cancellable(1000, 'never'))

      setTimeout(() => controller.abort(new Error('shutdown')), 5)
      const [, error] = await group.wait()

      assert.equal(group.signal.aborted, true)
      assert.equal(error.errors[0].message, 'shutdown')
    })

    it('adopts a deadline reason, keeping its TimeoutError name', async () => {
      const group = new ErrorGroup({ signal: AbortSignal.timeout(10) })
      group.run(cancellable(1000, 'never'))

      const [, error] = await group.wait()
      assert.equal(error.errors[0].name, 'TimeoutError')
    })

    it('passes its own signal to every thunk', async () => {
      const group = new ErrorGroup()
      let seen
      group.run(signal => {
        seen = signal
      })

      await group.wait()
      assert.equal(seen, group.signal)
    })

    it('cannot cancel a thunk that ignores the signal', async () => {
      const group = new ErrorGroup({ cancelOnError: true })
      group.run(async () => {
        throw new Error('boom')
      })
      group.run(async () => {
        await sleep(20)
        return 'ran anyway'
      })

      const [, error] = await group.wait()
      assert.equal([...error].length, 1)
      assert.equal(group.results[1].value, 'ran anyway')
    })
  })
})
