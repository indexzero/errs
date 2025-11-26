import fs from 'node:fs'
import errs from '../lib/errs.js'

function safeReadStream(filename, callback) {
  try {
    return fs.createReadStream(filename)
  } catch (err) {
    return errs.handle(err, callback)
  }
}

// Even without a callback, errors are handled gracefully
const file = fs.createReadStream('FileDoesNotExist.here')
file.on('error', (err) => {
  console.log('Stream error handled:')
  console.log(errs.format(err, { format: 'terminal' }))
})

// Example with callback pattern
console.log('Demonstrating safe stream creation...')
