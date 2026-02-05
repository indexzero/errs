import errs from '../lib/errs.js'

console.log('Transparent stack trace (no errs.js reference):')
console.log(
  errs
    .create('This is an error. There are many like it. It has a transparent stack trace.')
    .stack.split('\n')
)

// Demonstrate cause chain
console.log('\n--- Cause Chain Example ---')
const original = new Error('Original database error')
const wrapped = errs.merge(original, {
  message: 'Failed to fetch user',
  userId: 123
})

console.log('Wrapped error:', wrapped.message)
console.log('Cause:', wrapped.cause.message)
console.log('\nFormatted:')
console.log(errs.format(wrapped, { format: 'terminal', colors: false }))
