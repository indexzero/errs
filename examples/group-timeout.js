// group({ signal }): cancellation from the outside, including deadlines.
import errs from '../src/errs.js'

console.log('--- external AbortSignal as a deadline ---\n')

async function slowFetch(id, signal) {
  await new Promise((resolve, reject) => {
    const t = setTimeout(resolve, id * 40)
    signal?.addEventListener('abort', () => {
      clearTimeout(t)
      reject(signal.reason)
    })
  })
  return { id }
}

// Anything that produces an AbortSignal works: a server shutdown hook,
// a request-scoped controller, or a plain deadline.
const g = errs.group({ signal: AbortSignal.timeout(100), limit: 10 })

for (const id of [1, 2, 3, 4, 5]) {
  g.run(signal => slowFetch(id, signal))
}

// Style note on reading the failures. Three spellings, in order of
// preference. All three are supported; pick one per codebase.
//
// 1. byName(), when you care about the kind of failure. Preferred here,
//    because counting timeouts is exactly destructuring by type.
// 2. Iteration, when you want all of them: `[...err]` or `for..of err`.
//    The aggregate is iterable over its own `errors`.
// 3. Nested destructuring, which needs no helpers at all but costs you
//    the `= {}` guard and throws away the aggregate's message and cause:
//
//      const [all, { errors = [] } = {}] = await g.wait()
//      const timedOut = errors.filter(e => e.name === 'TimeoutError').length
//
//    One sharp edge there: a default only fires on `undefined`. The error
//    slot of a Result is `undefined` on success, so the line above is safe,
//    but `boundary.toAggregateError()` returns `null` when empty and that
//    same destructure throws a TypeError on it.
//
// Reaching for `err.errors` still works, it just reads worse than any
// of these.

const [all, err] = await g.wait()

if (err) {
  const { TimeoutError: timedOut = [] } = errs.byName(err)

  console.log('completed before deadline:', g.results.filter(r => r.ok).length)
  console.log('cut off by the deadline:  ', timedOut.length)
  console.log('every failure, by message:', [...err].map(e => e.message).join(' | '))
  console.log('\nvalue slot on failure:', all)
} else {
  console.log('everything beat the deadline:', all.length)
}
