// group({ cancelOnError: true }): first failure aborts the siblings.
import errs from '../src/errs.js'

console.log('--- cancelOnError: stop paying for doomed work ---\n')

async function step(name, ms, { signal, fail = false } = {}) {
  console.log(`  ${name} started`)
  try {
    await new Promise((resolve, reject) => {
      const t = setTimeout(resolve, ms)
      signal?.addEventListener('abort', () => {
        clearTimeout(t)
        reject(signal.reason)
      })
    })
  } catch (e) {
    console.log(`  ${name} aborted`)
    throw e
  }
  if (fail) throw new Error(`${name} failed`)
  console.log(`  ${name} finished`)
  return name
}

const g = errs.group({ cancelOnError: true })

// run() hands each thunk the group's signal. Forward it to anything
// cancellable and the whole group unwinds on the first failure.
g.run(signal => step('fast-fail', 10, { signal, fail: true }))
g.run(signal => step('slow-sibling', 500, { signal }))
g.run(signal => step('other-sibling', 500, { signal }))

const [, err] = await g.wait()

console.log('\nsignal aborted:', g.signal.aborted)
console.log('errors collected:', [...err].length)
console.log('reasons:', [...err].map(e => e.message).join(' | '))

// cancelOnError aborts with an AbortError whose cause is the original
// failure, so the siblings say why they stopped rather than repeating it.
const { AbortError: aborts = [] } = errs.byName(err)
console.log('aborts:', aborts.length, '| caused by:', aborts[0]?.cause.message)
