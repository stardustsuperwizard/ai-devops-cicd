# Derived state: a control plane that cannot drift

> *Field notes.* This page explains **why** a rule exists — the failure it
> came from. The rule itself is normative and lives in
> [`../../RULES.md`](../../RULES.md); the architecture it serves is in
> [`../architecture/`](../architecture/).
>
> **Rules this justifies:** OBS-1 … OBS-5, GAT-10.

The control plane is a generated, pinned document that answers the one thing a
saved view cannot: **what is unblocked right now, grouped by epic, in
dependency order.**

Every state it shows is **derived** — computed from the tracker's graph at the
moment it runs, and stored nowhere.

## Why not a board

A project board with a `Status` column is the obvious alternative, and it
fails for three reasons, in order of how fatal:

1. **A board cannot cause work.** If your platform has no automation trigger
   for a board-item change (many do not, or only at organisation scope), the
   board can record state and never act on it. A control plane that cannot
   cause anything is a report — so build an honest report.
2. **It usually needs elevated credentials.** A default CI token often cannot
   write board state, so a privileged token exists purely to keep a mirror in
   sync.
3. **It is a second source of truth.** Every `Status` value is already implied
   by item state, dependencies and markers. Eleven writes maintaining a copy of
   facts the tracker already stores, and any failed run leaves the copy wrong.

**Derived state cannot drift.** A failed render leaves the document visibly
stale, with its own timestamp, and never leaves the project misdescribed.

That property is what makes an on-demand refresh safe: the worst an unpressed
button can do is show you yesterday.

## The derivation

Task state, first match wins — **order matters**:

| Condition | State |
| --- | --- |
| Item closed | Done |
| Open blocking dependencies | Blocked — dependencies |
| No linked change proposal | **Ready to dispatch** |
| `validation:failed` marker | **Needs your attention** |
| Draft proposal open | Implementing |
| Proposal ready, no verdict marker | Awaiting review |
| `review:fix` / `planning-failure` / `design-ambiguity` | **Needs your attention** |
| `review:pass` | **Ready to merge** |

Epic state:

| Condition | State |
| --- | --- |
| Item closed | Done |
| Planner trigger present | Planning |
| No sub-items | Awaiting planning |
| Sub-items, some open | In progress |
| Sub-items, all closed | **Awaiting your sign-off** |

### Two ordering decisions worth copying

**Draft-ness is tested before verdict markers.** A draft proposal reads as
*Implementing* even when `review:fix` is still present, because that marker
persists through the bounded correction answering it. Testing draft-ness first
is what stops every in-flight fix from showing as waiting on you.

**`validation:failed` is tested *ahead* of draft-ness**, and that ordering is
the whole reason the marker exists. If a proposal is marked ready only after
its own validation passes, then *draft* is no longer merely "a session is
mid-flight" — a branch that fails validation stays draft until a human
intervenes. Left to the draft rule alone it would file itself under
*Implementing* forever, which is exactly the quietly-hidden failure the
dashboard exists to prevent.

`validation:failed` is also deliberately independent of the `review:*`
vocabulary: those record a judgement about the code, this records that the
build is broken. A `review:pass` sitting on a branch that no longer validates
is precisely the combination worth surfacing rather than averaging away.

## Render on demand

| How | When |
| --- | --- |
| Add a `dashboard:update` marker to any item | The normal way. Works from any client, including mobile |
| Dispatch the job manually | When you are already in the CI UI |

Four properties to build in:

- **The button is cleared by the last step of every run**, so re-adding it is
  another refresh.
- **Clearing is trigger-agnostic**: sweep *every* item carrying the marker,
  not only the one whose event fired. A render is a render, so a manual
  dispatch clears a pending request too.
- **Clearing runs unconditionally, even on failure.** The board is stale
  either way, and a stale board with the button already pressed is a dead end
  — you could not ask again without removing the marker by hand. The cost is
  that a failed refresh looks like one never requested; the run's own failure
  is where you see it.
- **Nothing subscribes to marker *removal***, so clearing cannot re-trigger.

### Consider keeping a schedule commented out, not deleted

A nightly render is the **staleness bound**: a missed refresh cannot leave the
board wrong for longer than a day. Without it, staleness is bounded only by
someone remembering to press the button.

Leaving the trigger commented out in the file rather than deleting it means it
can be restored with an editor and no thought. Same for an expensive
per-proposal trigger: comment, with the trade-off written next to it.

## Make it runnable locally

The renderer should be a plain script you can run against the live tracker
with no CI involved:

```bash
render-dashboard          # the markdown
render-dashboard --json   # just the derived states
```

That is what makes the derivation testable, and what lets you check the board
without spending a workflow run.

## Locate the document by marker, not by title

Find the pinned item by its `dashboard` marker, so renaming it is harmless. If
it is deleted, the next run creates and pins a new one. And put "do not edit
by hand — the next run overwrites the body" in the body itself.

## Per-item markers the dashboard should carry

Two flags earned by experience, both read out of the task body rather than
from any marker:

- **⚠️ — this task touches files an automated path handles badly** (binary
  scene formats, generated assets, anything where a merge conflict is
  unresolvable). Cheap models are a bad bet here.
- **🔑 — this task touches CI configuration itself**, which many automated
  identities cannot push at all. This matters most in the *Ready to dispatch*
  bucket, whose own instruction is "dispatch it" — and for these tasks that
  instruction is wrong.

Derive both from the task's expected-files section. A marker a human has to
remember to add is a marker that will be missing.
