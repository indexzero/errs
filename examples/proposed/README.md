---
status: proposed
runnable: false
requires:
  - errs.trap()
  - errs.trapSync()
  - errs.group()
  - parallel() accepting thunks
implemented:
  - iterable AggregateError
  - errs.byName()
  - errs.pick()
read_order:
  - error-order.js
  - trap-basics.js
  - trap-sync.js
  - boundary-accumulate.js
  - group-basics.js
  - group-cancel.js
  - group-timeout.js
  - typed-errors.js
  - pipeline.js
  - migration.js
on_conflict: "src/ wins; these examples describe an API that does not exist yet"
---

# Proposed API examples

Ten examples for the Go-shaped API. None of them run yet: `trap`, `trapSync`,
and `group` are not implemented, and `parallel` does not accept thunks. They are
here as the specification's worked form, and as the acceptance criteria for
implementing it.

`test/examples.test.sh` runs an explicit list of files and does not glob, so
nothing in this directory is wired into `pnpm test:examples`. Move each file up
to `examples/` and add a case to that script as the API it needs lands.

| File | Teaches |
| --- | --- |
| `error-order.js` | Value first, error last, and why a swapped destructure fails silently. Read first. |
| `trap-basics.js` | The three readings of one `Result`: tuple, named properties, tagged check. |
| `trap-sync.js` | `trapSync`, the `or` fallback as Go's zero value, and the loud failure on a forgotten `await`. |
| `boundary-accumulate.js` | Collecting every failure in a loop, then reporting once as an `AggregateError`. |
| `group-basics.js` | Thunks instead of started promises, `limit`, and per-task outcomes on `g.results`. |
| `group-cancel.js` | `cancelOnError` unwinding the siblings on first failure. |
| `group-timeout.js` | An external `AbortSignal` as a deadline over the whole group, and the three ways to read the failures. |
| `typed-errors.js` | Dispatching on the error slot with registered error types. |
| `pipeline.js` | Several fallible steps in one function body, and the caveat that tuples only work if every caller plays along. |
| `migration.js` | v1 `{ ok, value }` call sites living next to v2 tuples, plus the alias table. |

## Open questions these examples decide

Three details are settled here by example rather than by the spec prose, so
change the examples if you disagree.

`group.wait()` keeps strict `Result` semantics. The value slot is `undefined`
when anything failed, rather than a positionally holey array. Partial results
come from `g.results`, which is a `Result<T>[]` in run order.

`run()` passes the group's `AbortSignal` to each thunk as its only argument.
Forwarding it is the caller's job, so a thunk that ignores the signal simply
cannot be cancelled.

`parallel()` warns once when handed started promises instead of thunks, because
`limit` and `signal` cannot apply to work that is already in flight.

## Already landed

Three pieces these examples use are implemented on this branch and covered by
`node --test`, independent of the rest of the proposal. The aggregate returned by
`boundary.toAggregateError()` is iterable over its own errors, so `for..of`,
spread and array destructuring work on it. `errs.byName(input)` groups errors by
`name` for destructuring by type. `errs.pick(input, Class)` selects by
constructor. Both helpers accept an aggregate, an array, any iterable of errors,
or a single error, and neither depends on the iterator.
