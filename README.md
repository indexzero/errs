# errs

Simple error creation, boundaries, and formatting utilities for modern Node.js applications.

## Features

- **Simple Error Creation** - Create errors with custom properties in one line
- **Error Boundaries** - Effect-style error collection without immediate throwing
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

### Parallel Operations

#### `errs.parallel(promises, options)`

Run multiple promises and collect all errors.

```js
const { results, boundary } = await errs.parallel([
  fetchUser(1),
  fetchUser(2),
  fetchUser(3)
])

// Get successful values
const users = results
  .filter(r => r.status === 'fulfilled')
  .map(r => r.value)

// Check for errors
if (boundary.hasErrors()) {
  console.error(`${boundary.count} requests failed`)
}
```

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
import { create, boundary, format, parallel } from 'errs'

const err = create('Error message')
const bound = boundary()
```

## Subpath Exports

Import specific modules directly:

```js
import { ErrorBoundary } from 'errs/boundary'
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

- Node.js >= 20.0.0

## Migration from v0.x

See [MIGRATION.md](./MIGRATION.md) for detailed migration guide.

## License

MIT

## Contributors

- [Charlie Robbins](http://github.com/indexzero)
- [Nuno Job](http://github.com/dscape)
