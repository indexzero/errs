// A sequential pipeline. This is where the tuple earns its keep:
// several fallible steps in one function body, each with its own names.
import errs from '../../src/errs.js'

console.log('--- sequential steps, named bindings ---\n')

const db = {
  users: { 1: { id: 1, orgId: 7, name: 'Alice' } },
  orgs: { 7: { id: 7, plan: 'pro' } }
}

const fetchUser = async id => db.users[id] ?? Promise.reject(new Error(`no user ${id}`))
const fetchOrg = async id => db.orgs[id] ?? Promise.reject(new Error(`no org ${id}`))
const checkSeat = async org =>
  org.plan === 'pro' ? { seats: 25 } : Promise.reject(new Error('plan has no seats'))

// Each step reads like Go: do the work, check the error, move on.
// Nothing here is nested, and no binding shadows another.
async function loadSeat(userId) {
  const [user, userErr] = await errs.trap(() => fetchUser(userId))
  if (userErr) return [undefined, userErr]

  const [org, orgErr] = await errs.trap(() => fetchOrg(user.orgId))
  if (orgErr) return [undefined, orgErr]

  const [seat, seatErr] = await errs.trap(() => checkSeat(org))
  if (seatErr) return [undefined, seatErr]

  return [{ user: user.name, plan: org.plan, seats: seat.seats }, undefined]
}

const [found, foundErr] = await loadSeat(1)
console.log('happy path ->', found, '|', foundErr)

const [missing, missingErr] = await loadSeat(99)
console.log('sad path   ->', missing, '|', missingErr.message)

// The honest caveat: returning tuples by hand like this is the only way
// to keep errors out of the throw channel, and it only works if every
// caller plays along. One `throw` anywhere above and the chain is back
// to exceptions.
