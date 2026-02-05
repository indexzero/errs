# Upgrading to errs v1.0.0

This guide covers migrating from errs 0.x to 1.0.0. Version 1.0 is a major
rewrite with modern JavaScript features, new APIs, and some breaking changes.

## Requirements

- **Node.js 22.0.0 or later** (was: Node.js 0.8+)
- **ESM-only** (was: CommonJS)

## Breaking Changes

### 1. ESM Import Required

**Before (CommonJS):**
```javascript
const errs = require('errs');
```

**After (ESM):**
```javascript
import errs from 'errs';

// Or import specific functions
import { create, merge, boundary } from 'errs';
```

### 2. Error.prototype.toJSON Removed

The 0.x versions added a `toJSON` method to `Error.prototype`. This global
modification has been removed.

**Before:**
```javascript
const err = new Error('test');
JSON.stringify(err); // Worked via prototype
```

**After:**
```javascript
import { toJSON } from 'errs';

const err = new Error('test');
JSON.stringify(toJSON(err)); // Use explicit function
```

### 3. Stacktrace Module Removed

Integration with the `stacktrace` module has been removed. Error stack traces
are now handled natively.

**Before:**
```javascript
const errs = require('errs');
require('stacktrace'); // Was supported
```

**After:**
Stack traces work natively. If you need advanced stack manipulation, use
Node.js built-in `Error.captureStackTrace()` or the `error.cause` chain.

### 4. Source Directory Changed

Source files moved from `lib/` to `src/`. If you were importing internal
files directly (not recommended), update your paths:

**Before:**
```javascript
import { ErrorBoundary } from 'errs/lib/boundary.js';
```

**After:**
```javascript
import { ErrorBoundary } from 'errs/boundary';
```

## New Features

### ErrorBoundary for Collecting Errors

Collect multiple errors without throwing immediately:

```javascript
import errs from 'errs';

const boundary = errs.boundary();

// Collect validation errors
if (!email) boundary.add(new Error('Email required'));
if (!name) boundary.add(new Error('Name required'));

// Check and throw all at once
if (boundary.hasErrors()) {
  throw boundary.toAggregateError('Validation failed');
}
```

### trap() and trapAsync() for Safe Execution

Execute code and collect errors automatically:

```javascript
const boundary = errs.boundary();

// Sync
const result1 = boundary.trap(() => JSON.parse(userInput));

// Async
const result2 = await boundary.trapAsync(() => fetchUser(id));

// Results are { ok: true, value } or { ok: false, error }
if (result1.ok) {
  console.log(result1.value);
}
```

### Result Pattern with tryCatch

Go-style error handling without boundaries:

```javascript
import { tryCatch, tryCatchAsync } from 'errs';

const result = tryCatch(() => JSON.parse(input));
if (!result.ok) {
  console.error('Parse failed:', result.error.message);
  return;
}
console.log(result.value);
```

### Error Formatting

Format errors for different outputs:

```javascript
import { format } from 'errs';

const err = new Error('Something failed', { cause: originalError });

// Terminal output with box drawing
console.log(format(err, { format: 'terminal', colors: true }));

// JSON for logging
console.log(format(err, { format: 'json' }));

// HTML for web display (XSS-safe)
res.send(format(err, { format: 'html' }));
```

### Type Guards

TypeScript-friendly error checking:

```javascript
import { isErrorType, assertErrorType } from 'errs';

if (isErrorType(err, TypeError)) {
  // err is narrowed to TypeError
}

// Throws if not the expected type
const typeErr = assertErrorType(err, TypeError);
```

### Parallel Error Collection

Run multiple promises and collect all errors:

```javascript
import errs from 'errs';

const { results, boundary } = await errs.parallel([
  fetchUser(1),
  fetchUser(2),
  fetchUser(3)
]);

if (boundary.hasErrors()) {
  console.log(`${boundary.count} operations failed`);
}

const successful = results
  .filter(r => r.status === 'fulfilled')
  .map(r => r.value);
```

### Error Cause Chains

All error operations preserve cause chains:

```javascript
import errs from 'errs';

const dbError = new Error('Connection refused');
const appError = errs.merge(dbError, {
  message: 'Failed to fetch user'
});

console.log(appError.cause === dbError); // true
```

## Migration Checklist

- [ ] Update Node.js to 22.0.0 or later
- [ ] Change `require('errs')` to `import errs from 'errs'`
- [ ] Replace `JSON.stringify(err)` with `JSON.stringify(errs.toJSON(err))`
- [ ] Remove any `stacktrace` module usage
- [ ] Update any direct `lib/` imports to use package exports
- [ ] Consider adopting ErrorBoundary for error collection
- [ ] Consider adopting format() for error display

## TypeScript Support

Version 1.0 includes full TypeScript declarations. No additional `@types`
package needed:

```typescript
import errs, { ErrorBoundary, Result } from 'errs';

const boundary: ErrorBoundary = errs.boundary();
const result: Result<number> = errs.tryCatch(() => parseInt(input));
```

## Getting Help

- [GitHub Issues](https://github.com/indexzero/errs/issues)
- [Full Documentation](https://github.com/indexzero/errs#readme)
- [Changelog](./CHANGELOG.md)
