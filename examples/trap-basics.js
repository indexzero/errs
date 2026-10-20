// trap(): one call, three ways to read the result.
// Always returns a Promise<Result<T>>, so `await` is never optional.
import errs from '../src/errs.js'

console.log('--- trap(): reading a Result ---\n')

const bad = '{ "name": "Alice", '

// 1. Go-ish tuple. Value first, error last.
const [parsed, parseErr] = await errs.trap(() => JSON.parse(bad))
console.log('tuple  ->', parsed, '|', parseErr?.message)

// 2. Named properties, on the very same object.
const { value, error } = await errs.trap(() => JSON.parse(bad))
console.log('named  ->', value, '|', error?.message)

// 3. Tagged check. This is the v1.x shape and it still works.
const res = await errs.trap(() => JSON.parse(bad))
console.log('tagged ->', res.ok, '|', res.ok ? res.value : res.error.message)

// trap() takes sync fns, async fns, and plain promise-returning fns.
// Detection looks at what fn returned, not at what fn is.
const [a] = await errs.trap(() => 42)
const [b] = await errs.trap(async () => 'from async fn')
const [c] = await errs.trap(() => Promise.resolve('from plain fn'))
console.log('\naccepts ->', a, '|', b, '|', c)

// Anything thrown that is not an Error gets normalized to one.
const [, thrown] = await errs.trap(() => {
  throw 'a bare string'
})
console.log('normalized ->', thrown instanceof Error, '|', JSON.stringify(thrown.message))
