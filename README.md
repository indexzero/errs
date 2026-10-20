# errs

Simple error creation, boundaries, and formatting utilities for modern Node.js applications.

## Features

- **Simple Error Creation** - Create errors with custom properties in one line
- **Error Boundaries** - Collect errors without immediate throwing
- **Type Guards** - Runtime type checking for errors with TypeScript support
- **Go-style Results** - `trap()` returns `[value, error]` instead of throwing
- **Bounded Concurrency** - `group()` runs thunks with a limit and cancellation
- **Multi-Format Output** - Format errors for terminal, JSON, or HTML
- **Native Cause Chains** - Built-in support for ES2022 `Error.cause`
- **Error Type Registration** - Register and reuse custom error types
- **Zero Dependencies** - No runtime dependencies

## Installation

```sh
npm install errs
```

## Quick Start

```js
import errs from 'errs'

// Create errors with custom properties
const err = errs.create({
  message: 'User not found',
  status: 404,
  code: 'USER_NOT_FOUND'
})

// Collect multiple errors without throwing
const boundary = errs.boundary()
boundary.add(new Error('Validation failed'))
boundary.add(new Error('Invalid email'))
if (boundary.hasErrors()) {
  boundary.throwIfErrors()
}

// Format errors for different outputs
console.log(errs.format(err, { format: 'terminal' }))
```

## API Reference

### Creating Errors

#### `errs.create(opts)`

Creates a new error with custom properties.

```js
// From a string
const err = errs.create('Something went wrong')

// From an object
const err = errs.create({
  message: 'Database connection failed',
  status: 500,
  code: 'DB_ERROR'
})

// From an array (joined with spaces)
const err = errs.create(['Invalid', 'request', 'parameters'])

// From a function
const err = errs.create(() => ({
  message: 'Dynamic error',
  timestamp: Date.now()
}))
```

#### `errs.create(type, opts)`

Creates an error of a registered type.

```js
class ValidationError extends Error {
  name = 'ValidationError'
}

errs.register('validation', ValidationError)

const err = errs.create('validation', {
  message: 'Invalid input',
  field: 'email'
})
```

### Merging Errors

#### `errs.merge(error, opts)`

Merges an existing error with new properties and sets native cause chain.

```js
try {
  await fetchData()
} catch (original) {
  throw errs.merge(original, {
    message: 'Failed to load user data',
    userId: 123
  })
  // merged.cause === original
}
```

### Error Boundaries

#### `errs.boundary(options)`

Creates an ErrorBoundary for collecting errors without immediate throwing.

```js
const boundary = errs.boundary({
  maxErrors: 100,      // Maximum errors to collect (default: 1000)
  captureStack: true   // Capture creation point (default: true)
})

// Collect errors
try {
  validateEmail(data.email)
} catch (e) {
  boundary.add(e)
}

try {
  validateAge(data.age)
} catch (e) {
  boundary.add(e)
}

// Check and throw if errors exist
if (boundary.hasErrors()) {
  console.log(`Collected ${boundary.count} errors`)
  boundary.throwIfErrors('Validation failed')
}

// Or get as AggregateError
const aggregate = boundary.toAggregateError()

// Clear and reuse
boundary.clear()
```

#### ErrorBoundary Methods

- `add(error)` - Add an error to the boundary
- `hasErrors()` - Check if any errors collected
- `count` - Get number of errors
- `errors` - Get copy of all errors
- `toAggregateError(message)` - Convert to AggregateError
- `throwIfErrors(message)` - Throw if errors exist
- `clear()` - Remove all errors
- `trap(fn, options)` - Execute any function, trap errors to boundary. Always async
- `trapSync(fn, options)` - Synchronous trap, returns a Result directly
- `trapAsync(fn, options)` - Deprecated alias of `trap()`

The aggregate from `toAggregateError()` is iterable over its own errors, so
`for..of`, spread and array destructuring work on it without an `.errors` hop.

#### `errs.trap(fn)` / `errs.trapSync(fn)`

Execute a function and get a Result back instead of a throw.

```js
const [user, err] = await errs.trap(() => fetchUser(1))
if (err) return [undefined, err]
```

`trap()` always returns a Promise, whether `fn` is sync, async, or a plain
function returning a promise. The synchronous door is a separate method rather
than a second return shape, so there is no sync-or-async return to guess at.
A forgotten `await` throws a TypeError **if you destructure the tuple**, because
promises are not iterable. The other two readings stay quiet: `.ok` and `.value`
on a promise are both `undefined`, which reads as a failure that never happened.
That is a reason to prefer the tuple at call sites you are migrating.

```js
const [config, err] = errs.trapSync(() => JSON.parse(raw))

// `or` supplies Go's zero value, so the value slot is usable on failure
const [config] = errs.trapSync(() => JSON.parse(raw), { or: defaults })
```

#### The Result shape

One object, three readings. **Order is value first, error last**, following Go
rather than Node's error-first callbacks.

```js
const [value, error] = await errs.trap(fn)  // tuple
const { value, error } = await errs.trap(fn)  // named properties
const r = await errs.trap(fn); if (r.ok) use(r.value)  // tagged check
```

The named properties are non-enumerable, so a Result serializes as a plain
two-element array.

#### `boundary.trap(fn)` / `boundary.trapSync(fn)`

The same thing, but every error also lands in the boundary, so you can collect
across many calls and report once.

```js
const boundary = errs.boundary()

for (const row of rows) {
  const [record, err] = boundary.trapSync(() => JSON.parse(row))
  if (!err) records.push(record)
}

boundary.throwIfErrors(`${boundary.count} rows failed to parse`)
```

### Concurrency

#### `errs.group(options)`

Runs thunks with bounded concurrency, collecting every failure rather than
rejecting on the first. The group owns the launch, which is what lets a limit
and a cancellation signal apply at all.

```js
const g = errs.group({ limit: 4, cancelOnError: true })

for (const id of ids) {
  g.run(signal => fetchUser(id, { signal }))
}

const [users, err] = await g.wait()
if (err) throw err  // AggregateError carrying every failure
```

Options are `limit`, `signal`, `cancelOnError`, and `boundary`, plus
`maxErrors` and `captureStack`, which are passed to a boundary the group
creates for itself. `run()` hands
each thunk the group's signal, so forwarding it is the caller's job: a thunk
that ignores it cannot be cancelled. `wait()` keeps strict Result semantics, so
its value slot is `undefined` when anything failed; per-task outcomes live on
`g.results` as a `Result[]` in run order.

With `cancelOnError`, the abort reason is an Error named `AbortError` whose
`cause` is the original failure, so siblings report why they stopped instead of
repeating the root error.

The aggregate from `wait()` holds this group's failures only, even when the
boundary is shared with another group, pre-filled, cleared, or at its
`maxErrors` cap. The boundary accumulates across groups; the aggregate answers
"what did my tasks do".

Two edges worth knowing. A group you never `wait()` on **swallows every failure
silently**: tasks never reject, so there is no unhandled rejection to alert you.
And calling `run()` after `wait()` has resolved runs the task anyway, with
nobody awaiting it; a later `wait()` will pick it up, and the configured
external signal still applies.

If the boundary hits its `maxErrors` cap, the aggregate is truncated but the
failure count is not: it comes from the per-task results, and the message says
how many were actually collected.

### Enforcing the check

The one way a tuple is weaker than the throw it replaces is that nothing makes
you look at the error. Go leans on its compiler, where an unused variable is a
build failure. The package ships the missing half as a Biome plugin:

```json
{ "plugins": ["./node_modules/errs/plugins/no-dropped-error.grit"] }
```

It flags the slot being dropped outright, which no generic rule can see because
there is no unused binding left to complain about:

```js
const [res] = await errs.trap(fn)  // error silently swallowed -> flagged
```

Biome's built-in `noUnusedVariables` already covers the other half, where the
error is destructured and then never read. Read `.value` instead of taking a
one-element tuple to say that you meant to ignore it, or suppress with a reason
via `// biome-ignore lint/plugin:` on the line above.

It covers `const`, `let` and `var`. It deliberately does not flag a bare
`wait()` or an unrelated `mutex.wait()`, so a group held in a variable whose
name has no `g`/`group` prefix goes unchecked.

#### Reading the failures

Three ways, none of which need `.errors`:

```js
const [, err] = await g.wait()

for (const e of err) { }                       // iterable aggregate
const { TimeoutError = [] } = errs.byName(err)  // destructure by name
const timeouts = errs.pick(err, TimeoutError)   // select by constructor
```

### Type Guards

#### `errs.isErrorType(error, ErrorClass)`

Type guard that checks if an error is an instance of a specific class.

```js
try {
  await fetchData()
} catch (err) {
  if (errs.isErrorType(err, TypeError)) {
    // TypeScript knows err is TypeError here
    console.log('Type error occurred')
  }
}
```

#### `errs.isRegisteredType(error, typeName)`

Check if an error matches a registered type name.

```js
errs.register('validation', ValidationError)

if (errs.isRegisteredType(err, 'validation')) {
  // Handle validation error
}
```

#### `errs.assertErrorType(error, ErrorClass, message?)`

Assert error is a specific type, throws TypeError if not.

```js
function handleHttpError(err) {
  // Throws TypeError if err is not HttpError
  const httpErr = errs.assertErrorType(err, HttpError)
  return httpErr.status // TypeScript knows this is HttpError
}
```

### Deprecated aliases

`tryCatch` is an alias of `trapSync()` and `tryCatchAsync` is an alias of
`trap()`. Both still work and return the same hybrid Result, so existing
`result.ok` and `result.value` call sites are unaffected. They are removed in
the next major.

### Parallel Operations

#### `errs.parallel(tasks, options)`

Run multiple tasks and collect all errors. Prefer thunks, which the group
launches itself so that `limit` and `signal` apply.

```js
const { results, boundary } = await errs.parallel(
  [1, 2, 3].map(id => signal => fetchUser(id, { signal })),
  { limit: 2 }
)

// Get successful values
const users = results
  .filter(r => r.status === 'fulfilled')
  .map(r => r.value)

// Check for errors
if (boundary.hasErrors()) {
  console.error(`${boundary.count} requests failed`)
}
```

An array of already-started promises still works and keeps the v1 behaviour,
but warns once: neither `limit` nor `signal` can apply to work that is already
in flight. Reach for `errs.group()` directly when you want the Result tuple and
per-task outcomes rather than settled-style results.

### Error Formatting

#### `errs.format(error, options)`

Format errors for different output targets.

```js
// Terminal output with colors
console.log(errs.format(error, { format: 'terminal', colors: true }))

// JSON for logging
logger.error(errs.format(error, { format: 'json', indent: 2 }))

// HTML for error pages
res.send(errs.format(error, { format: 'html' }))
```

**Terminal Output:**

```
╭─ TypeError: Cannot read property 'x' of undefined
│
│  at processUser (src/users.js:42:15)
│  at async main (src/index.js:10:3)
│
├─ Caused by: NetworkError: Connection refused
│
│  at fetch (src/api.js:23:9)
│
╰─ 2 errors in chain
```

### Error Handling

#### `errs.handle(error, callback, stream)`

Unified error handling for callbacks and EventEmitters.

```js
// With callback
errs.handle(err, (e) => console.error(e))

// With EventEmitter
errs.handle(err, emitter)

// With both
errs.handle(err, callback, emitter)

// Returns emitter if no callback
const emitter = errs.handle(err)
emitter.on('error', handleError)
```

### Type Registration

#### `errs.register(type, ErrorClass)`

Register a custom error type.

```js
class HttpError extends Error {
  name = 'HttpError'
  constructor(message, status) {
    super(message)
    this.status = status
  }
}

errs.register('http', HttpError)

// Use registered type
const err = errs.create('http', {
  message: 'Not found',
  status: 404
})
```

#### `errs.unregister(type)`

Unregister an error type.

```js
errs.unregister('http')
```

### JSON Conversion

#### `errs.toJSON(error)`

Convert error to JSON-serializable object.

```js
const err = new Error('Test error')
err.code = 'TEST_CODE'

const json = errs.toJSON(err)
// { message: 'Test error', stack: '...', code: 'TEST_CODE' }
```

## Named Exports

All functions are available as named exports:

```js
import {
  create,
  boundary,
  format,
  parallel,
  group,
  trap,
  trapSync,
  byName,
  pick,
  isErrorType,
  isRegisteredType,
  assertErrorType
} from 'errs'

const err = create('Error message')
const bound = boundary()
const [parsed, parseErr] = trapSync(() => JSON.parse(data))
```

## Subpath Exports

Import specific modules directly:

```js
import { ErrorBoundary } from 'errs/boundary'
import { ErrorGroup } from 'errs/group'
import { ok, fail } from 'errs/result'
import { format } from 'errs/format'
```

## Use Cases

### Form Validation

```js
const boundary = errs.boundary()

if (!email.includes('@')) {
  boundary.add(new Error('Invalid email'))
}
if (password.length < 8) {
  boundary.add(new Error('Password too short'))
}

boundary.throwIfErrors('Validation failed')
```

### Batch Processing

```js
const boundary = errs.boundary()

for (const item of items) {
  try {
    await processItem(item)
  } catch (err) {
    boundary.add(err)
  }
}

if (boundary.hasErrors()) {
  console.error(`${boundary.count} items failed`)
  await logErrors(boundary.errors)
}
```

### API Error Formatting

```js
app.use((err, req, res, next) => {
  res.status(err.status || 500).send(
    errs.format(err, { format: 'json' })
  )
})
```

## Requirements

- Node.js >= 22.0.0

## Migration from v0.x

See [MIGRATION.md](./MIGRATION.md) for detailed migration guide.

## License

MIT

## Contributors

- [Charlie Robbins](http://github.com/indexzero)
- [Nuno Job](http://github.com/dscape)
