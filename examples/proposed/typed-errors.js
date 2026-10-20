// Registered error types meet the error slot.
import errs from '../../src/errs.js'

console.log('--- dispatching on the error slot ---\n')

// errs.create() calls your constructor with the message string, then
// copies any remaining option keys onto the instance.
class NotFoundError extends Error {
  constructor(message = 'Not found') {
    super(message)
    this.name = 'NotFoundError'
    this.status = 404
  }
}

class RateLimitError extends Error {
  constructor(message = 'Rate limited') {
    super(message)
    this.name = 'RateLimitError'
    this.status = 429
    this.retryAfter = 1
  }
}

errs.register('notfound', NotFoundError)
errs.register('ratelimit', RateLimitError)

async function loadUser(id) {
  if (id === 2) throw errs.create('notfound', { message: `user ${id} is gone` })
  if (id === 3) throw errs.create('ratelimit', { retryAfter: 30 })
  return { id, name: `user-${id}` }
}

for (const id of [1, 2, 3]) {
  const [user, err] = await errs.trap(() => loadUser(id))

  if (!err) {
    console.log(`${id}: ok     ->`, user.name)
  } else if (errs.isErrorType(err, NotFoundError)) {
    console.log(`${id}: 404    ->`, err.message)
  } else if (errs.isErrorType(err, RateLimitError)) {
    console.log(`${id}: 429    -> retry in ${err.retryAfter}s`)
  } else {
    console.log(`${id}: unknown ->`, err.message)
  }
}
