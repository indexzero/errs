# Migration Guide: v0.x → v1.0

This guide covers migrating from errs v0.3.x to v1.0.

## Breaking Changes Summary

1. **Node.js 20+ Required** - Drop support for Node.js < 20
2. **ESM Only** - CommonJS is no longer supported
3. **Error.prototype.toJSON Removed** - Use `errs.toJSON()` function instead
4. **Deprecated Properties** - `error.description` and `error.stacktrace` removed

## Step-by-Step Migration

### 1. Update Node.js Version

Ensure you're running Node.js 20 or later:

```sh
node --version  # Should be >= v20.0.0
```

### 2. Convert to ESM

**Before (CommonJS):**

```js
const errs = require('errs')

const err = errs.create('Error message')
```

**After (ESM):**

```js
import errs from 'errs'

const err = errs.create('Error message')
```

If you need specific functions:

```js
import { create, merge, boundary } from 'errs'
```

### 3. Replace Error.prototype.toJSON

The global `Error.prototype.toJSON` polyfill has been removed for safety.

**Before:**

```js
const err = new Error('Test')
const json = err.toJSON()  // Used global polyfill
```

**After:**

```js
import { toJSON } from 'errs'

const err = new Error('Test')
const json = toJSON(err)  // Use utility function
```

### 4. Use Native Error.cause

The `merge()` function now uses native `Error.cause` instead of custom properties.

**Before:**

```js
const merged = errs.merge(original, { message: 'Wrapped' })
// merged.description === original.message
// merged.stacktrace === original.stack.split('\n')
```

**After:**

```js
const merged = errs.merge(original, { message: 'Wrapped' })
// merged.cause === original (native cause chain)
// Access via merged.cause.message and merged.cause.stack
```

### 5. Update Custom Error Types

Replace `util.inherits` with ES6 classes.

**Before:**

```js
const util = require('util')

function MyError(message) {
  Error.call(this)
  this.message = message
}
util.inherits(MyError, Error)

errs.register('myerror', MyError)
```

**After:**

```js
class MyError extends Error {
  name = 'MyError'
  constructor(message) {
    super(message)
  }
}

errs.register('myerror', MyError)
```

## New Features in v1.0

### Error Boundaries

Collect multiple errors without immediate throwing:

```js
import errs from 'errs'

const boundary = errs.boundary()

try {
  validateEmail(email)
} catch (e) {
  boundary.add(e)
}

try {
  validateAge(age)
} catch (e) {
  boundary.add(e)
}

if (boundary.hasErrors()) {
  boundary.throwIfErrors('Validation failed')
}
```

### Parallel Error Collection

```js
const { results, boundary } = await errs.parallel([
  fetchUser(1),
  fetchUser(2),
  fetchUser(3)
])

const users = results
  .filter(r => r.status === 'fulfilled')
  .map(r => r.value)

if (boundary.hasErrors()) {
  console.error(`${boundary.count} requests failed`)
}
```

### Error Formatting

```js
// Terminal with colors
console.log(errs.format(err, { format: 'terminal' }))

// JSON for logging
logger.error(errs.format(err, { format: 'json' }))

// HTML for error pages
res.send(errs.format(err, { format: 'html' }))
```

## Migration Checklist

- [ ] Update Node.js to v20 or later
- [ ] Convert all `require('errs')` to `import errs from 'errs'`
- [ ] Replace `error.toJSON()` with `errs.toJSON(error)`
- [ ] Update custom error types to use ES6 classes
- [ ] Replace `util.inherits` with `class extends Error`
- [ ] Update error merging to use native `cause` instead of `description`
- [ ] Test all error handling code
- [ ] Consider using new ErrorBoundary for validation
- [ ] Consider using `errs.format()` for error output

## Common Migration Issues

### Issue: Module Not Found

**Problem:**

```
Error [ERR_REQUIRE_ESM]: require() of ES Module not supported
```

**Solution:**

1. Convert to ESM by adding `"type": "module"` to your `package.json`
2. Change all `.js` files to use `import`/`export`
3. Use `.cjs` extension for any remaining CommonJS files

### Issue: toJSON is not a function

**Problem:**

```js
const json = err.toJSON()
// TypeError: err.toJSON is not a function
```

**Solution:**

```js
import { toJSON } from 'errs'
const json = toJSON(err)
```

### Issue: Missing description property

**Problem:**

```js
const merged = errs.merge(original, { message: 'New' })
console.log(merged.description)  // undefined
```

**Solution:**

```js
const merged = errs.merge(original, { message: 'New' })
console.log(merged.cause.message)  // Use native cause
```

## Compatibility

### Supported Platforms

- Node.js >= 20.0.0
- Works with: npm, yarn, pnpm, bun

### Breaking Change Impact

| Change | Impact | Mitigation |
|--------|--------|-----------|
| ESM only | High | Convert to ESM or use dynamic import() |
| Node 20+ | High | Update Node.js version |
| toJSON removal | Medium | Use errs.toJSON(error) |
| description/stacktrace | Low | Use native cause chain |

## Testing Your Migration

Run this test to verify your migration:

```js
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import errs from 'errs'

describe('Migration verification', () => {
  it('creates errors', () => {
    const err = errs.create({ message: 'Test', code: 'TEST' })
    assert.equal(err.message, 'Test')
    assert.equal(err.code, 'TEST')
  })

  it('merges with cause', () => {
    const original = new Error('Original')
    const merged = errs.merge(original, { message: 'Wrapped' })
    assert.equal(merged.cause, original)
  })

  it('converts to JSON', () => {
    const err = new Error('Test')
    const json = errs.toJSON(err)
    assert.equal(json.message, 'Test')
  })
})
```

## Getting Help

- [Report Issues](https://github.com/indexzero/errs/issues)
- [API Documentation](./README.md)

## What's Next?

- Explore ErrorBoundary for validation scenarios
- Use `errs.parallel()` for concurrent operations
- Try `errs.format()` for better error output
- Consider TypeScript types (coming soon)
