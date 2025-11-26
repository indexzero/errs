import fs from 'node:fs'
import errs from '../lib/errs.js'

process.on('uncaughtException', (err) => {
  console.log('Caught exception:')
  console.log(errs.merge(err, { namespace: 'uncaughtException' }))
  console.log('\nFormatted:')
  console.log(errs.format(err, { format: 'terminal' }))
})

// This will trigger the uncaughtException handler
fs.createReadStream('FileDoesNotExist.here')
