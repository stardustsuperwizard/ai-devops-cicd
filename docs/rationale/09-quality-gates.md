# Quality gates: stopping the cheapest way to green

> *Field notes.* This page explains **why** a rule exists — the failure it
> came from. The rule itself is normative and lives in
> [`../../RULES.md`](../../RULES.md); the architecture it serves is in
> [`../architecture/`](../architecture/).
>
> **Rules this justifies:** GAT-1 … GAT-11, HUM-2.

An agent optimises for the check going green. Every gate below exists because
there is a cheap, wrong way to achieve that, and a human reviewer will not
reliably catch it in a large diff.

None of these gates are about distrust. They are about the fact that "make the
check pass" and "make the code correct" are different objectives that usually
coincide, and the gates catch the cases where they do not.

## Gate 1 — the red gate

**Claim:** a test added by this change must have been **red at the merge
base**.

A new test that passes against the pre-change code tests nothing the code did
not already do. It is the single most common way a change proposal arrives
with impressive-looking coverage and zero new verification.

Implementation sketch:

1. Determine which test suites the change puts **in scope** (changed test
   files, plus suites owning changed production files).
2. Check out the **merge base** into a scratch worktree.
3. Run the in-scope suites there and capture the log.
4. Verdict: every in-scope suite must have been **red** at the merge base.

### Three implementation details that matter

**Pick the unit of measurement deliberately, and write down why.** Per-suite
is usually the honest answer, because most harnesses emit no machine-readable
per-function result. Report changed function names *for the human*, but never
make them a verdict — a verdict you cannot compute is a verdict that will be
faked.

**Parse the log by whole-line match against a registered set, never by
prefix.** Suites print their own failures with strings like `FAIL <message>`,
so a prefix match reads free-text violation text as suite results.

**Separate "the change is wrong" from "the gate could not decide."** Use
distinct exit codes:

| Exit | Meaning | Human override |
| --- | --- | --- |
| `0` | Every in-scope suite was red at the base | — |
| `1` | A suite was green at the base | **Allowed**, with a marker and a recorded reason |
| `2` | The gate could not reach a verdict — unusable inputs | **Never** |

Blurring 1 and 2 means a broken gate looks like an approved exception.

### The legitimate exception

A refactor whose new test covers behaviour that already worked is a real case.
That is what the `characterization-test` marker is for: a human approves it,
records the reason in the proposal body, and re-runs the job. See
[`06-state-markers.md`](06-state-markers.md) for why it must be **add the
marker, then re-run** — the marker add alone does nothing.

## Gate 2 — the test ratchet

**Claim:** neither the suite count nor the assertion count may fall.

Deleting the failing test is always the cheapest path to green, and in a
300-line diff nobody sees it.

1. Count suites and assertions at the merge base.
2. Count them at the head.
3. Fail if either total dropped.

Override with a `test-removal-approved` marker, read live, same procedure.

Two notes from experience: strip comments before counting (a commented-out
assertion is a removed one), and sequence the ratchet **behind** the job that
actually runs the suite rather than beside it — the gate's claim depends on
the head being green, and that is a fact another job already proved. Do not
pay for a second full run.

## Gate 3 — validation before "ready"

An implementer marks its change proposal **ready for review only if its own
validation passed.** A branch that fails validation stays draft and takes a
`validation:failed` marker.

This is what turns "draft" from a transient state into a meaningful one, and
it is why the dashboard tests `validation:failed` ahead of draft-ness — see
[`07-derived-state.md`](07-derived-state.md). Without the marker, a finished
and broken branch files itself under *Implementing* forever.

## Gate 4 — deterministic first, model second

Where a fixer touches formatting or lint:

1. Run the **deterministic** formatter unconditionally. No model.
2. Only the residue the formatter cannot touch — findings the tool has no
   auto-fix for — goes to a **capped** session, scoped to exactly those
   findings and the files they are in.

Never spend a model on work a deterministic tool does correctly and for free.
And note that this is a narrow, deliberate exception to the rule that model
spend requires a human tap: it is bounded by the tool's own findings list, not
by a judgement call.

## Gate 5 — the base-branch check

Keep a scheduled job that runs the full suite against the **default branch**
on its own. Without it you cannot distinguish "this change broke it" from "it
has been broken since Tuesday", and you will spend fix cycles on failures that
are not the change's.

When a failure is red on the base branch too, that is the one legitimate "not
this change's problem" — and it still is not silence. Port the fix if one
exists, and say so.

## Gate 6 — human-decision boundaries

Some things no agent should resolve:

- a `DESIGN AMBIGUITY` verdict — the contract is underspecified;
- a `PLANNING FAILURE` verdict — back to the planner, not the fixer;
- changes to the CI configuration itself, which most automated identities
  cannot push anyway;
- anything requiring a credential a machine identity does not hold.

Mark tasks in these categories at plan time, derived from their expected-files
list, so the dashboard shows them as needing a person **before** someone
dispatches an agent at them. See [`07-derived-state.md`](07-derived-state.md).

## What every gate needs

| Requirement | Why |
| --- | --- |
| Runs on a **read-only** token | It must work on fork contributions |
| Writes its report to the run summary, not back to the tracker | Same reason |
| Has an override marker read **live** | Otherwise a legitimate exception blocks forever |
| Prints the override procedure in its own failure message | Nobody remembers "add the marker, then re-run" |
| Is runnable locally, with no CI | Otherwise it cannot be tested or trusted |
