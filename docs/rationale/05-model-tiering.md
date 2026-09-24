# Model tiering and cost routing

> *Field notes.* This page explains **why** a rule exists — the failure it
> came from. The rule itself is normative and lives in
> [`../../RULES.md`](../../RULES.md); the architecture it serves is in
> [`../architecture/`](../architecture/).
>
> **Rules this justifies:** SES-5 … SES-10, DEC-2, HUM-3.

Optimise for cost and quality. Latency is explicitly **not** a goal — every
stage boundary is a place work waits for a human anyway.

## Route per role, not per pipeline

| Role | Tier | Reasoning |
| --- | --- | --- |
| **Planner** | Strongest | Planning is where the expensive mistakes are made. It reads the whole epic, reads code before it is written, and allocates every other role's budget. The role that allocates tiers should not be cheaper than what it allocates. |
| **Implementer** | Per task — see below | The tasks are not alike |
| **Reviewer** | Strongest | Blind judgement against criteria; a cheap pass here costs a defect |
| **Fixer** | Middle, escalating | Bounded, contract-driven work — but see *escalation* below |
| **Lint fixer / triage** | Cheapest | Narrow, deterministic-adjacent, capped |

The shape to notice: **blind work gets the expensive model; contract-driven
work gets the cheap one.** A planner facing an undecomposed epic and a
reviewer facing an unseen diff are both working without a spec. An implementer
holding a task item with acceptance criteria is not.

## The implementer's tier is chosen per task

Every other role gets one setting for the whole repository. The implementer
gets a starting point **per work item**, because adding a field and its
accessor is not the same work as changing how authority is resolved, and
paying the same model for both wastes money on one and risks the other.

**The planner sets it.** It is the only role that sees the whole epic at once
and reads the code before it is written, so it is the only one positioned to
judge — and it is already the most capable model in the pipeline.

The rubric:

| Tier | When |
| --- | --- |
| **cheap** | The work is fully determined by the contract. Mechanical; a wrong choice is obvious and cheap to undo |
| **middle** | The default, and the answer when unsure |
| **strong** | A wrong choice is expensive to undo — architecture, cross-cutting state, anything other tasks will build on |

It travels as a **label or field on the work item** (`model:cheap`,
`model:middle`, `model:strong`), with the reasoning mirrored in a *Model Tier*
section of the item body. **The label is what the automation reads; the prose
is what lets a human check the call and relabel by hand when it looks wrong.**
Nothing re-reads the prose.

### It is a tier, not a model ID — and that is load-bearing

Write `model:strong`, never `model:claude-opus-5`, on a work item.

Model IDs change; work items live for months. A tier is a statement about the
work, which stays true. A model ID baked into a backlog item is a statement
about a vendor's catalogue on the day the item was filed, and it silently
rots.

Resolve tier → model ID in exactly one place, in configuration, overridable
without a commit.

## Preference lists, because availability is per-identity

Each role gets a **comma-separated preference list**, tried in order:

```
PLANNER_MODELS   = strongest, next-strongest, fallback
IMPLEMENTER_MODELS = (per tier)
REVIEWER_MODELS  = strongest, next-strongest, fallback
FIXER_MODELS     = middle, strong
```

Two rules about walking the list:

1. **Advance only on unavailability** — the model is not reachable for this
   identity. Never advance after a real failure. A cheap retry after a genuine
   failure silently defeats whatever tier the caller chose, and you get a
   Haiku-grade review of a pull request the planner deliberately tiered to
   Opus.
2. **Never fall *down* past the role's floor.** If the cheap tier is
   unavailable, fall **up**. A cheap tier that degrades to an even cheaper one
   is a tier that means nothing.

Keep the lists in repository configuration (variables, not secrets) so
changing one does not require a commit.

## A single session-wide fallback chain must escalate only

Some environments cannot express per-role lists — a local agent harness may
offer one fallback chain for the **whole session**, applied to every role in
it.

In that case the chain must **escalate only**:

```jsonc
{ "fallbackModel": ["strong-model", "stronger-model"] }
```

A natural-looking `[middle, cheap]` chain would hand the cheap model the
review of work deliberately tiered up — the exact outcome the per-task tiering
refuses. Escalate-only is the one shape a single shared chain can take without
contradicting everything else.

It costs more only when a model is genuinely unavailable, which is rare. A
review done cheaply because the strong model was busy costs a fix cycle, and
that is not cheaper.

## A proposal that keeps coming back buys a better model

The fixer escalates one tier per repeat round on the same change proposal.

Round 1 is the cheap explanation: the fixer misread the verdict. Round 3 is
almost never that. By round 3 the likely cause is that the task item was
underspecified or the design is wrong, and those are not problems a cheaper
model solves by trying harder.

Cap it. After N rounds (3 is a reasonable default) stop escalating and
**escalate to a human** instead — the correct next model is a person.

## The two-namespace hazard

Different CLIs spell the same model differently: `claude-opus-4.8` in one,
`claude-opus-4-8` in another. **Do not copy model IDs between CLIs.**

The failure is quiet. An unreachable ID is skipped and the chain moves on, so
a mistyped ID looks exactly like a chain that was never needed. Your only
defence is to dump the CLI's own model list into the run log, so a rejected ID
is self-diagnosing rather than a mystery.

## Measure, do not assume

Record per session: role, tier, model actually used, outcome, duration, and
cost. Without that ledger you cannot tell a tier that is too cheap from a task
item that was badly written, and those have opposite fixes.

An "auto" model selector is a measurement problem as much as a cost one: if
you do not know which model ran, you cannot attribute the outcome.

## Two budget knobs that are not the same knob

Vendors cap sessions differently — some by **credits spent**, some by **turns
taken**. There is no conversion between them.

Credits price what a session spent; turns count how many times it acted. A
role whose credit cap was tuned by watching it work is **not tuned at all** on
the other vendor. Set both, per role, from observation — and never assume one
implies the other.

A session that hits its ceiling must be classified `budget_exhausted`, not
`completed`, so a truncated answer is never mistaken for a finished one. See
[`08-session-outcomes.md`](08-session-outcomes.md).
