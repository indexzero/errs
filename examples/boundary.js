import errs from '../src/errs.js'

// Example: Form Validation with Error Boundary
console.log('--- Form Validation Example ---\n')

const formData = {
  email: 'invalid-email',
  age: -5,
  name: ''
}

const boundary = errs.boundary()

if (!formData.email.includes('@')) {
  boundary.add(new Error('Invalid email format'))
}
if (formData.age < 0) {
  boundary.add(new Error('Age must be a positive number'))
}
if (!formData.name) {
  boundary.add(new Error('Name is required'))
}

console.log(`Collected ${boundary.count} validation errors`)

if (boundary.hasErrors()) {
  const aggregate = boundary.toAggregateError('Validation failed')
  console.log('\nJSON format:')
  console.log(errs.format(aggregate, { format: 'json', indent: 2 }))
}

// Example: Parallel Operations
console.log('\n--- Parallel Operations Example ---\n')

async function main() {
  const operations = [
    Promise.resolve({ id: 1, name: 'Alice' }),
    Promise.reject(new Error('User 2 not found')),
    Promise.resolve({ id: 3, name: 'Charlie' }),
    Promise.reject(new Error('Database timeout'))
  ]

  const { results, boundary: opBoundary } = await errs.parallel(operations)

  const successfulUsers = results.filter(r => r.status === 'fulfilled').map(r => r.value)

  console.log('Successful users:', successfulUsers)
  console.log(`Failed operations: ${opBoundary.count}`)

  if (opBoundary.hasErrors()) {
    console.log('\nErrors:')
    console.log(errs.format(opBoundary.toAggregateError(), { format: 'terminal', colors: false }))
  }
}

main().catch(console.error)
