# State markers and trigger markers

> *Field notes.* This page explains **why** a rule exists — the failure it
> came from. The rule itself is normative and lives in
> [`../../RULES.md`](../../RULES.md); the architecture it serves is in
> [`../architecture/`](../architecture/).
>
> **Rules this justifies:** DSP-1 … DSP-10.

Every stage starts because a **marker was added to a work item**. On GitHub
that marker is a label; on Jira a status transition or a field; on any
tracker, some small mutable attribute a person can set from a phone.

Getting the vocabulary right is most of the control plane.

## Three kinds of marker, and they behave differently

| Kind | Added by | Consumed? | Example |
| --- | --- | --- | --- |
| **Trigger** | A human | **Yes** — the workflow removes it | `agent:reviewer:claude` |
| **State** | Automation or a human | No — it persists | `planned`, `review:pass`, `blocker` |
| **Button** | A human | Yes, always, even on failure | `dashboard:update` |

Mixing them up is the commonest design error. A trigger that is not consumed
cannot be retried. A state marker that *is* consumed takes the queryable state
with it.

## Why a consumed trigger is the right shape

Each workflow **removes the marker it consumed**. That buys three properties:

- **It works from a phone.** Adding a label is something every client can do,
  including ones with no agent controls at all. This matters more than it
  sounds: the whole pipeline stays operable from a device with no terminal.
- **Re-adding a consumed marker is a clean retry.** No separate re-run verb,
  no "did that actually re-dispatch?" ambiguity.
- **No workflow fires on its own output**, so there are no dispatch loops.

That last one is a hard constraint, not a nicety. Automation that writes the
marker it triggers on will loop, and it will loop expensively.

## Encode the routing *in the marker name*

```
agent:{role}:{vendor}
```

| Segment | Chooses |
| --- | --- |
| `role` | Which workflow fires |
| `vendor` | Which CLI runs and **which account pays** |

So `agent:reviewer:anthropic` and `agent:reviewer:claude` run the identical
reviewer, differing only in the bill. **The choice of who pays is made by
putting a label on a work item, not by editing a workflow.** That is worth
engineering for — it is the difference between "switch billing" being a
one-tap operation and a pull request.

## State markers must be mutually exclusive by construction

`plan` (awaiting decomposition) and `planned` (decomposed) are applied and
consumed such that an item can never carry both. That is what makes
`is:open label:plan` an **exact** queue rather than an approximate one.

If two state markers can coexist, every query over them becomes a judgement
call, and the dashboard starts hedging.

## The one marker that is both

A `blocker` marker is a trigger (adding it wires up dependencies) *and* a
state (an item carries it for as long as something waits on it, so
`is:open label:blocker` is an exact list of what the backlog is queued
behind).

Being both costs the retry story: **re-adding a marker that is already present
is not an event**, so a failed run cannot be retried by re-labelling. Provide
a manual dispatch with a "sweep everything" option instead.

Worth the trade — a trigger that got consumed would take the queryable state
with it, and the state is the more useful half. But make the trade
deliberately, and write down that it was made.

## Human-approval markers

Some gates need a human to say *yes, this is the legitimate case*:

| Marker | Means |
| --- | --- |
| `test-removal-approved` | A human approved this change lowering the test or assertion count |
| `characterization-test` | A human approved this new test legitimately passing on the merge base |

These are read **live from the API** by the job that gates on them, never from
the event payload — and that detail bites hard enough to spell out:

> Change-proposal events often do not fire on `labeled`, and re-running a job
> usually **replays the original event payload** rather than fetching a fresh
> one. A marker added *after* a red gate would never appear if the job trusted
> that payload.

So the documented procedure is **add the marker, then re-run the job.**
Re-running is what makes the job look again; the marker add by itself does
nothing. Write that in the failure message the gate prints, because nobody
will remember it.

## What fires without a tap

Review should fire automatically when a change proposal becomes ready for
review. It is a safety net on work you already chose to start, and gating it
means an unreviewed proposal can sit looking finished.

Everything that *spends model budget on a new decision* should need a tap.
Everything that *checks work already started* should not.

## Bootstrap them, or nothing fires and nothing says why

Every trigger is keyed on a marker **name**. A fresh repository has none of
them, so on arrival the entire control plane is inert — no errors, no logs,
no explanation.

Ship a `bootstrap-labels` script that creates every marker idempotently, and
make running it step one of setup. Workflows that lazily create the markers
they write are not enough: the `agent:{role}:{vendor}` triggers are written by
*humans*, so no workflow ever creates them.

## Colours are cosmetic

Nothing should ever read a marker's colour back — only its name. Keep it that
way, and say so in the docs, so that recolouring is known to be safe.
