/*
 * conformance.ts: asserts the hand-written src/*.d.ts agree with the JSDoc
 * in src/*.js.
 *
 * (C) 2011-2025, Charlie Robbins, Nuno Job, and the Contributors.
 * MIT LICENSE
 *
 * The declarations are hand-written on purpose: they express things JSDoc
 * cannot, such as the correlated Result union that makes `if (err) return`
 * narrow the value slot. The cost of hand-writing them is drift, and drift
 * here is invisible -- a declaration can be valid TypeScript, lint-clean, and
 * still describe a function that does not exist. `tsc` cannot catch it,
 * because a sibling .d.ts makes it drop the .js from the program entirely.
 *
 * So this file compares two module shapes:
 *
 *   Hand -- `src/*.js` resolved through the hand-written `src/*.d.ts`
 *   Gen  -- `.types-gen/*.d.ts`, derived from the JSDoc by tsconfig.types-gen.json
 *
 * and asserts they are mutually assignable. Each direction catches a
 * different class of lie:
 *
 *   Gen  <- Hand   catches the declaration being MORE DEMANDING than the code:
 *                  a parameter the implementation does not take, a required
 *                  argument that is actually optional.
 *
 *   Hand <- Gen    catches the declaration PROMISING MORE than the code has:
 *                  an export the module never makes (which throws at import),
 *                  a method that is not there.
 *
 * A failure here means one of the two sides is wrong. Fixing it on the JSDoc
 * side is as legitimate as fixing it on the declaration side; the point is
 * that they can no longer disagree silently.
 */

import type * as GenBoundary from '../../.types-gen/boundary.js'
import type * as GenErrs from '../../.types-gen/errs.js'
import type * as GenFormat from '../../.types-gen/format.js'
import type * as GenGroup from '../../.types-gen/group.js'
import type * as GenResult from '../../.types-gen/result.js'
import type * as HandBoundary from '../../src/boundary.js'
import type * as HandErrs from '../../src/errs.js'
import type * as HandFormat from '../../src/format.js'
import type * as HandGroup from '../../src/group.js'
import type * as HandResult from '../../src/result.js'

declare const handErrs: typeof HandErrs
declare const genErrs: typeof GenErrs
declare const handBoundary: typeof HandBoundary
declare const genBoundary: typeof GenBoundary
declare const handGroup: typeof HandGroup
declare const genGroup: typeof GenGroup
declare const handResult: typeof HandResult
declare const genResult: typeof GenResult
declare const handFormat: typeof HandFormat
declare const genFormat: typeof GenFormat

// Gen <- Hand: the declaration must not be more precise than the JSDoc.
//
// Asserted only for the modules that export no class. A class with private
// fields is NOMINALLY typed, so the generated declaration carries a
// `#private` brand that cannot be made interchangeable with a hand-written
// one: omit it and the member is missing, declare it and TypeScript reports
// that it "refers to a different member". Both were tried. That makes this
// direction unachievable for boundary, group, and errs (which returns an
// ErrorBoundary), and it is the only reason. Every other divergence was
// closed by making the JSDoc as precise as the declaration: create() and
// register() gained @overload tags, CreateInput and CreateOptions were
// aligned, makeIterable() and toAggregateError() gained their iterable
// return, wait() gained its aggregate error type, and parallel() gained its
// generic parameter.
// For the class-exporting modules the nominal brand only blocks the class
// itself, so assert this direction per export instead, covering everything
// whose type does not transitively mention one. Without these, loosening a
// JSDoc annotation in errs.js would go unnoticed.
export const createNotDemanding: typeof GenErrs.create = handErrs.create
export const mergeNotDemanding: typeof GenErrs.merge = handErrs.merge
export const handleNotDemanding: typeof GenErrs.handle = handErrs.handle
export const registerNotDemanding: typeof GenErrs.register = handErrs.register
export const unregisterNotDemanding: typeof GenErrs.unregister = handErrs.unregister
export const toJSONNotDemanding: typeof GenErrs.toJSON = handErrs.toJSON
export const isErrorTypeNotDemanding: typeof GenErrs.isErrorType = handErrs.isErrorType
export const isRegisteredTypeNotDemanding: typeof GenErrs.isRegisteredType =
  handErrs.isRegisteredType
export const assertErrorTypeNotDemanding: typeof GenErrs.assertErrorType = handErrs.assertErrorType
export const trapNotDemanding: typeof GenErrs.trap = handErrs.trap
export const trapSyncNotDemanding: typeof GenErrs.trapSync = handErrs.trapSync
export const byNameNotDemanding: typeof GenErrs.byName = handErrs.byName
export const pickNotDemanding: typeof GenErrs.pick = handErrs.pick
export const makeIterableNotDemanding: typeof GenBoundary.makeIterable = handBoundary.makeIterable

export const resultNotDemanding: typeof GenResult = handResult
export const formatNotDemanding: typeof GenFormat = handFormat

// Hand <- Gen: the declaration must not promise more than the code has.
export const errsNotOverPromising: typeof HandErrs = genErrs
export const boundaryNotOverPromising: typeof HandBoundary = genBoundary
export const groupNotOverPromising: typeof HandGroup = genGroup
export const resultNotOverPromising: typeof HandResult = genResult
export const formatNotOverPromising: typeof HandFormat = genFormat

/*
 * Arity assertions.
 *
 * Assignability does not catch a declaration that adds an OPTIONAL parameter
 * the implementation does not take, because a function of fewer parameters is
 * assignable to one expected to take more, in both directions. That exact
 * drift shipped here once: `toJSON` was declared `(error, seen?)` while the
 * implementation had moved the cycle guard into a private helper and taken
 * only `(error)`. Both conformance directions passed.
 *
 * So pin the declared arity. The matching runtime assertion lives in
 * test/errs.test.js, which checks `fn.length` against the same numbers; the
 * pair is what makes the two sides inescapable.
 */

type Arity<F extends (...args: never[]) => unknown> = Parameters<F>['length']

type AssertEqual<Actual, Expected> = [Actual] extends [Expected]
  ? [Expected] extends [Actual]
    ? true
    : { expected: Expected; got: Actual }
  : { expected: Expected; got: Actual }

export const toJSONArity: AssertEqual<Arity<typeof HandErrs.toJSON>, 1> = true
export const byNameArity: AssertEqual<Arity<typeof HandErrs.byName>, 1> = true
export const pickArity: AssertEqual<Arity<typeof HandErrs.pick>, 2> = true
export const trapArity: AssertEqual<Arity<typeof HandErrs.trap>, 1 | 2> = true
export const trapSyncArity: AssertEqual<Arity<typeof HandErrs.trapSync>, 1 | 2> = true
export const groupArity: AssertEqual<Arity<typeof HandErrs.group>, 0 | 1> = true
export const formatArity: AssertEqual<Arity<typeof HandFormat.format>, 1 | 2> = true
export const makeIterableArity: AssertEqual<Arity<typeof HandBoundary.makeIterable>, 1> = true
