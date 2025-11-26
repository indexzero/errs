import errs from '../lib/errs.js'

class MyError extends Error {
  name = 'MyError'

  constructor(message = 'This is my error; I made it myself. It has a transparent stack trace.') {
    super(message)
  }
}

// Register the error type
errs.register('myerror', MyError)

console.log(
  errs.create('myerror')
    .stack
    .split('\n')
)

// Demonstrate with additional properties
const err = errs.create('myerror', {
  message: 'Custom message',
  code: 'CUSTOM_ERROR',
  status: 500
})

console.log('\nCustom error with properties:')
console.log('Name:', err.name)
console.log('Message:', err.message)
console.log('Code:', err.code)
console.log('Status:', err.status)
