import fs from 'node:fs'
import errs from '../lib/errs.js'

// Safe stream creation that handles errors gracefully
function safeReadStream(filename, callback) {
  try {
    return fs.createReadStream(filename)
  } catch (err) {
    return errs.handle(err, callback)
  }
}

// Demonstrate error handling with streams
console.log('Demonstrating safe stream creation...')

const file = safeReadStream('FileDoesNotExist.here', err => {
  console.log('Callback received error:')
  console.log(errs.format(err, { format: 'terminal' }))
})

file.on('error', err => {
  console.log('Stream error handled:')
  console.log(errs.format(err, { format: 'terminal' }))
})
