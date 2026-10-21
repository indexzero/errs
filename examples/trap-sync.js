// trapSync(): the explicitly synchronous door, plus Go's zero value.
import errs from '../src/errs.js'

console.log('--- trapSync(): no promise, no await ---\n')

// No await. The Result comes back directly.
const [config, err] = errs.trapSync(() => JSON.parse(process.env.APP_CONFIG ?? 'not json'))
console.log('without fallback ->', config, '|', err?.message)

// `or` supplies the zero value Go would have handed you, so the
// first slot is usable even on the error branch.
const [withDefault, stillErr] = errs.trapSync(
  () => JSON.parse(process.env.APP_CONFIG ?? 'not json'),
  { or: { host: 'localhost', port: 3000 } }
)
console.log('with fallback    ->', withDefault, '|', stillErr?.message)

// Why trap() is always async: a forgotten await fails loudly.
// Promises are not iterable, so array destructuring throws instead of
// quietly handing you undefined for every slot.
try {
  // biome-ignore lint/plugin: destructuring the array is exactly what throws here
  const [oops] = errs.trap(() => 1)
  console.log('unreachable', oops)
} catch (e) {
  console.log('\nforgotten await ->', `${e.constructor.name}:`, e.message)
}
