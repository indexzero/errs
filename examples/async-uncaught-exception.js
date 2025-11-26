import fs from 'node:fs'
import errs from '../lib/errs.js'

process.on('uncaughtException', (err) => {
  console.log(errs.merge(err, { namespace: 'uncaughtException' }))
  console.log('\nFormatted output:')
  console.log(errs.format(err, { format: 'terminal' }))
})

const file = fs.createReadStream(import.meta.filename, { encoding: 'utf8' })
file.on('data', () => { throw new Error('Oh Noes') })
