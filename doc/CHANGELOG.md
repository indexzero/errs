# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- **Go-shaped Results** - `trap()`, `trapSync()` and `group().wait()` return an
  array of `[value, error]` that also carries `ok`, `value` and `error` as
  non-enumerable properties, so the tuple, named-property and tagged readings
  all work on one object. Order is value first, error last.
  - `or` option supplies a failure value, the analogue of Go's zero value
- **ErrorGroup** (`errs.group()`, `errs/group`) - bounded, cancellable
  concurrency over thunks, collecting every failure into a boundary
  - `limit` caps tasks in flight; a freed slot is handed straight to the next
    waiter so a later task cannot slip past the limit
  - `signal` accepts an external AbortSignal, adopting its reason, so an
    `AbortSignal.timeout()` works as a deadline
  - `cancelOnError` aborts the siblings on first failure, with an `AbortError`
    whose `cause` is the original failure
  - `results` exposes per-task Results in run order for partial recovery
- **Iterable AggregateError** - `toAggregateError()` returns an aggregate that
  is iterable over its own errors, so `for..of`, spread and array destructuring
  work without an `.errors` hop
- **byName() and pick()** - group errors by `name` for destructuring by type,
  or select them by constructor
- `errs/result` subpath export for `Result`, `ok()`, `fail()` and `normalize()`

### Changed

- **BREAKING: `boundary.trap()` is now async.** It accepts sync functions,
  async functions and plain promise-returning functions, and always returns a
  Promise. The synchronous door is `boundary.trapSync()`. A missed migration
  fails loudly, since array-destructuring a Promise throws a TypeError.
- `errs.parallel()` prefers thunks, which it launches itself so that `limit`
  and `signal` apply. Started promises still work and keep the v1 return shape
  but warn once, because neither option can apply to work already in flight.

### Fixed

- `toJSON()` no longer takes a `seen` parameter in its public signature, which
  made `errors.map(errs.toJSON)` pass the array index as the cycle guard and
  throw. The guard is now an internal ancestor stack.
- `toJSON()` and `format(..., 'json')` no longer report a shared reference as
  `[Circular]`. They tracked visited values rather than ancestors, so any DAG
  looked circular. This mattered most under `cancelOnError`, where every
  sibling rejects with the same AbortError whose cause is the root failure.
- `byName()` uses a null-prototype record, so an error named `constructor`,
  `toString` or `hasOwnProperty` no longer throws.
- `group().wait()` counts and aggregates from the group's own failures rather
  than the boundary, which may be shared, pre-filled, cleared, or capped. A
  shared boundary could previously drop a group's failure silently.
- An external `signal` keeps working after the first `wait()`. The listener was
  detached there, silently disconnecting a reused group from its signal. A
  `WeakRef` plus a `FinalizationRegistry` now lets an un-waited group be
  collected and removes its listener, instead of pinning it to the signal.
- `normalize()` no longer throws on a value whose `String()` conversion throws,
  such as a null-prototype object. Thrown from inside a catch block, it escaped
  as an unhandled rejection and could end the process.
- `trapSync()` refuses a function that returns a promise instead of reporting
  success with a pending promise in the value slot and letting the rejection
  escape.
- Terminal and HTML formats no longer grow without bound on a circular `cause`,
  which aborted the process. All three walkers now guard.
- `format()` renders non-Error causes and non-Error aggregate members instead of
  printing `undefined: undefined` or throwing.
- `parallel()` attaches a no-op handler to already-started promises before
  refusing mixed input, so the argument error is what surfaces.
- `group()` rejects a non-integer `limit`; `1.5` previously allowed two in
  flight.
- `results` omits tasks still in flight rather than exposing `undefined` holes
  under a type promising dense Results.
- `Result<T>` correlates its tuple halves, so `const [v, e] = ...; if (e)
  return; v.x` narrows under `strict`. `wait()` is typed as an iterable
  AggregateError, `byName()`/`pick()` accept an ErrorBoundary, and the root
  `ErrorGroup` type export, which had no runtime counterpart, is gone.
- `.gitignore` had `.DS_Store` and `dist/` merged onto one line, so neither was
  ignored.
- A Result is frozen. `result[0] = x` previously succeeded while `.value` kept
  the old value, and `.ok = false` failed with no visible reason, so the two
  readings could disagree.
- `toJSON()` caps recursion at depth 10, matching the JSON formatter, instead
  of following a cause chain of any length.
- `group.run()` throws a TypeError when handed a non-function, rather than
  collecting "fn is not a function" into the aggregate as though a task failed.
- A caller-supplied boundary whose `add()` throws no longer turns into a
  `wait()` rejection that loses the real failure.
- Terminal format now renders an `AggregateError`'s collected errors as an
  indented list, instead of walking only `cause` and leaving them invisible.
  The footer reports both chain depth and collected count.
- `toJSON()` now includes `errors` and `cause`, which are non-enumerable when
  set by the constructor and so were missed by the enumerable-key copy. Adds a
  cycle guard and the error's `name`.
- `group().wait()` counts failed tasks from its own per-task results rather
  than from `boundary.count`, which under-reported when the boundary was at its
  `maxErrors` cap. It also still reports failure when `maxErrors` is 0.

### Added

- `plugins/no-dropped-error.grit`, a Biome plugin flagging a Result whose error
  slot is dropped outright, which `noUnusedVariables` cannot see. Covers
  `const`, `let` and `var`, and is now shipped in the package.
- `check:js` script and `tsconfig.check.json`, which actually typecheck the
  JSDoc in `src/*.js`. The main config cannot: a sibling `.d.ts` exists for
  every `.js`, so TypeScript drops the `.js` from the program and `checkJs`
  silently does nothing. 53 pre-existing errors in `errs.js` and `format.js`
  remain, so it is not yet wired into `check`.

### Deprecated

- `boundary.trapAsync(fn)` - alias of `trap()`
- `errs.tryCatch(fn)` - alias of `trapSync()`
- `errs.tryCatchAsync(fn)` - alias of `trap()`

## [1.0.0] - 2025-02-05

### Added

- **ErrorBoundary class** for collecting multiple errors
  - `add(error)` - Add errors to the boundary
  - `trap(fn)` - Execute sync function and collect errors
  - `trapAsync(fn)` - Execute async function and collect errors
  - `toAggregateError()` - Convert to AggregateError
  - `throwIfErrors()` - Throw if any errors collected
  - `clear()` - Reset the boundary
- **format() utility** with multiple output formats
  - `terminal` - Box-drawing characters with optional colors
  - `json` - Structured JSON with parsed stack traces
  - `html` - HTML with XSS protection
- **Type guards and assertions**
  - `isErrorType(error, ErrorClass)` - Type guard for error classes
  - `isRegisteredType(error, typeName)` - Check registered types
  - `assertErrorType(error, ErrorClass)` - Assert with TypeError
- **Result pattern** (Go-style error handling)
  - `tryCatch(fn)` - Wrap sync function in Result
  - `tryCatchAsync(fn)` - Wrap async function in Result
- **parallel()** - Run promises with automatic error collection
- **Error cause chain support** throughout (`error.cause`)
- **TypeScript declarations** (.d.ts files)
- **GitHub Actions CI** with Node.js 22, 24 and Bun

### Changed

- **BREAKING**: Requires Node.js >= 22.0.0
- **BREAKING**: ESM-only package (no CommonJS)
- **BREAKING**: Source moved from `lib/` to `src/`
- Migrated from ESLint to Biome
- Migrated from vows to node:test
- Migrated from Travis CI to GitHub Actions
- Updated all dependencies to latest versions
- Modernized all examples

### Removed

- **BREAKING**: Removed `Error.prototype.toJSON` polyfill
- **BREAKING**: Removed stacktrace module integration
- Removed CommonJS support
- Removed Travis CI configuration
- Removed legacy test framework (vows)

## [0.3.2] - 2015-05-19

### Fixed

- Travis CI configuration updates

## [0.3.1] - 2015-03-12

### Changed

- Updated vows dependency

## [0.3.0] - 2014-09-15

### Changed

- Allow for falsy base errors in `errs.merge()`
- Updated vows dependency

## [0.2.4] - 2014-06-10

### Fixed

- Be far more liberal in `errs.create()` for truthy and falsy values
- Check for `err.stack` existence in `merge()`

## [0.2.3] - 2014-03-20

### Fixed

- Respect custom `name` property in stack trace

## [0.2.2] - 2013-11-05

### Added

- `Error.prototype.toJSON` polyfill if not already present
- JSHint compliance

### Fixed

- Optimize mixin against arguments array-ification

## [0.2.1] - 2013-08-12

### Fixed

- Minor whitespace and code style fixes

## [0.2.0] - 2012-03-15

### Added

- `errs.merge()` for combining errors
- `errs.handle()` for error handling with callbacks and EventEmitters
- `errs.register()` and `errs.unregister()` for custom error types

## [0.1.1] - 2011-12-10

### Fixed

- Initial bug fixes after release

## [0.1.0] - 2011-12-01

### Added

- Initial release
- `errs.create()` for creating errors with properties
- Transparent stack traces (no errs.js in stack)
- Support for string, object, array, and function arguments

[1.0.0]: https://github.com/indexzero/errs/compare/v0.3.2...v1.0.0
[0.3.2]: https://github.com/indexzero/errs/compare/v0.3.1...v0.3.2
[0.3.1]: https://github.com/indexzero/errs/compare/v0.3.0...v0.3.1
[0.3.0]: https://github.com/indexzero/errs/compare/v0.2.4...v0.3.0
[0.2.4]: https://github.com/indexzero/errs/compare/v0.2.3...v0.2.4
[0.2.3]: https://github.com/indexzero/errs/compare/v0.2.2...v0.2.3
[0.2.2]: https://github.com/indexzero/errs/compare/v0.2.1...v0.2.2
[0.2.1]: https://github.com/indexzero/errs/compare/v0.2.0...v0.2.1
[0.2.0]: https://github.com/indexzero/errs/compare/v0.1.1...v0.2.0
[0.1.1]: https://github.com/indexzero/errs/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/indexzero/errs/releases/tag/v0.1.0
