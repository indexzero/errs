// Argument order. Read this one before you write any others.
import errs from '../src/errs.js'

console.log('--- value first, error last ---\n')

// errs follows Go: the value is the subject, the error trails it.
const [value, error] = await errs.trap(() => JSON.parse('nope'))
console.log('correct ->', 'value:', value, '| error:', error?.message)

// Node callbacks taught a decade of muscle memory for the opposite.
// Swapping the slots does NOT throw, because both are often truthy.
// It just silently inverts your control flow:
const [err, val] = await errs.trap(() => JSON.parse('nope'))
console.log('swapped ->', 'err:', err, '| val:', val?.message)
console.log('\nif (err) would be FALSE here, and the failure sails through.')

// Two defenses. Name the bindings so a swap reads wrong out loud:
const [user, userErr] = await errs.trap(() => JSON.parse('nope'))
if (userErr) console.log('\nnamed bindings ->', userErr.message)
console.log('user is', user)

// And prefer the named properties anywhere the order is not obvious.
const { error: configErr } = await errs.trap(() => JSON.parse('nope'))
console.log('named property ->', configErr.message)
