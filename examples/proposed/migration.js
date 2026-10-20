// Migrating from v1. The Result is an array that also has properties,
// so old call sites keep working next to new ones.
import errs from '../../src/errs.js'

console.log('--- v1 and v2 reading the same Result ---\n')

const b = errs.boundary()

// v1.x code, untouched.
const v1 = b.trapSync(() => JSON.parse('{"ok":true}'))
if (v1.ok) {
  console.log('v1 style ->', v1.value)
}

// v2 code, same method, same return value.
const [parsed, err] = b.trapSync(() => JSON.parse('{"ok":true}'))
console.log('v2 style ->', parsed, '|', err)

// Renamed in v2. The old names remain as aliases through the v2 line
// and are removed in v3:
//   boundary.trapAsync(fn)  ->  boundary.trap(fn)
//   errs.tryCatch(fn)       ->  errs.trapSync(fn)
//   errs.tryCatchAsync(fn)  ->  errs.trap(fn)
const legacy = await b.trapAsync(async () => 'still works')
console.log('\nalias    ->', legacy.value, '| also:', legacy[0])

// parallel() now prefers thunks so it can bound and cancel. Passing
// started promises still works, but warns once: the work is already
// in flight, so `limit` and `signal` cannot apply to it.
const { boundary: pb } = await errs.parallel([
  () => Promise.resolve('a'),
  () => Promise.reject(new Error('b failed'))
])
console.log('parallel ->', pb.count, 'error collected')
