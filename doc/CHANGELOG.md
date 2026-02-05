# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
