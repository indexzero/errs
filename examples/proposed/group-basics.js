// group(): bounded concurrency with error collection. This is errgroup.
import errs from '../../src/errs.js'

console.log('--- group(): the group owns the launch ---\n')

let inFlight = 0
let peak = 0

async function fetchUser(id) {
  inFlight += 1
  peak = Math.max(peak, inFlight)
  try {
    await new Promise(resolve => setTimeout(resolve, 20))
    if (id % 3 === 0) {
      throw errs.create({ message: `user ${id} not found`, status: 404 })
    }
    return { id, name: `user-${id}` }
  } finally {
    inFlight -= 1
  }
}

const ids = [1, 2, 3, 4, 5, 6]
const g = errs.group({ limit: 2 })

// run() takes a thunk, not a started promise. Nothing is in flight yet.
for (const id of ids) {
  g.run(() => fetchUser(id))
}

const [users, err] = await g.wait()

console.log('peak concurrency:', peak, '(limit was 2)')
console.log('all succeeded:  ', users !== undefined)

if (err) {
  // Result semantics are strict: the value slot is undefined when
  // anything failed. Per-task outcomes live on g.results, in run order.
  // The aggregate is iterable over its own errors, so no `.errors` hop.
  console.log('\nfailures:', [...err].length, 'of', ids.length)
  for (const e of err) {
    console.log(' -', e.message, `(status ${e.status})`)
  }

  const ok = g.results.filter(r => r.ok).map(r => r.value)
  console.log('\npartial results:', ok.map(u => u.name).join(', '))
}
