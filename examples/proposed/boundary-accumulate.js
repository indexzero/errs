// boundary.trapSync(): collect every failure, report once at the edge.
import errs from '../../src/errs.js'

console.log('--- accumulating across a loop ---\n')

const rows = [
  '{"id":1,"email":"a@example.com"}',
  '{"id":2,"email":}',
  '{"id":3,"email":"c@example.com"}',
  'not json at all'
]

const b = errs.boundary()
const records = []

for (const row of rows) {
  // The error lands in the boundary AND comes back in the tuple.
  const [record, err] = b.trapSync(() => JSON.parse(row))
  if (!err) records.push(record)
}

console.log(`parsed ${records.length} of ${rows.length} rows`)
console.log(`boundary holds ${b.count} errors`)

if (b.hasErrors()) {
  // One AggregateError carries every failure, with the boundary's
  // creation site attached as `cause`. It is iterable over those failures.
  const aggregate = b.toAggregateError(`${b.count} rows failed to parse`)

  for (const [i, e] of [...aggregate].entries()) {
    console.log(`  ${i + 1}. ${e.message}`)
  }

  console.log(`\n${errs.format(aggregate, { format: 'json', indent: 2 })}`)

  // Or let it throw at the boundary of your unit of work:
  //   b.throwIfErrors(`${b.count} rows failed to parse`)
}
