# Porting worksheet

Copy this file into your project and fill it in **before writing any code**.
Phase 0 of [`build-guide-for-agents.md`](build-guide-for-agents.md) is
complete when every row has an answer and every gap has a named degradation.

An unanswered row is a decision you will make by accident later.

---

## Project

| | |
| --- | --- |
| Project / repo | |
| Tracker | |
| CI system | |
| SCM | |
| Filled in by / date | |

## The eight primitives

| # | Primitive | Our implementation | Present? | Degradation if not |
| --- | --- | --- | --- | --- |
| P1 | Work item | | ☐ | |
| P2 | Hierarchy (parent ↔ child) | | ☐ | |
| P3 | Dependency ("A blocks B"), queryable | | ☐ | |
| P4 | Mutable marker | | ☐ | |
| P5 | Marker-change event | | ☐ | |
| P6 | Session runner | | ☐ | |
| P7 | Change proposal | | ☐ | |
| P8 | Durable comment | | ☐ | |

### The two questions that are never obvious

**Can a non-admin set a trigger marker from a mobile client, in two taps?**

> Answer:

If no, the pipeline is not operable from a phone, and that is the property
that makes marker-driven dispatch worth building. Reconsider P4 before
continuing.

**Can the CI identity push to CI configuration?**

> Answer:

If no, tasks touching CI config are undispatchable by any automated path.
Plan-time detection (the 🔑 flag) must exist from the start, and the
*Ready to dispatch* bucket's instruction is wrong for those tasks.

## Vendors

| vendor name | CLI | credential | billed to | budget unit |
| --- | --- | --- | --- | --- |
| | | | | |
| | | | | |

Ship phase 3 with one vendor and phase 4 with the second. If you will only
ever have one, **still build the `vendor` input** — the cost is one case
statement and it is the seam that keeps the rest vendor-blind.

## Model tiers

| Tier | Model ID | Notes |
| --- | --- | --- |
| cheap | | |
| middle | | |
| strong | | |

| Role | Preference list | Budget cap | Capability |
| --- | --- | --- | --- |
| Planner | | | read-only |
| Implementer | per-task tier | | write |
| Reviewer | | | read-only |
| Fixer | | | write |

Where does tier → model ID resolve? (One place only, in config, changeable
without a commit.)

> Answer:

## Marker vocabulary

Adjust names to your platform's constraints (no spaces on Jira, etc.), then
keep them fixed.

| Marker | Kind | Added by | Consumed by |
| --- | --- | --- | --- |
| `agent:planner:<vendor>` | trigger | human | planner job |
| `agent:implementer:<vendor>` | trigger | human | implementer job |
| `agent:reviewer:<vendor>` | trigger | human | reviewer job |
| `agent:fixer:<vendor>` | trigger | human | fixer job |
| `plan` | state | intake template | planner (on success) |
| `planned` | state | planner | — |
| `implementation` | state | planner | — |
| `blocker` | **both** | planner, human | dependency job (not consumed) |
| `model:cheap\|middle\|strong` | state | planner | implementer (reads) |
| `review:*` | state | reviewer | — |
| `validation:failed` | state | implementer | — |
| `test-removal-approved` | state | **human only** | ratchet gate (reads live) |
| `characterization-test` | state | **human only** | red gate (reads live) |
| `dashboard` | state | renderer | — |
| `dashboard:update` | button | human | renderer (always clears) |

Anything added? Anything dropped, and why?

> Answer:

## Capability postures

| | Read-only | Write |
| --- | --- | --- |
| Vendor A flags | | |
| Vendor B flags | | |

Is each harness **additive** or **subtractive**?

> Vendor A:
> Vendor B:

Getting this wrong produces a session that runs, does nothing, and looks
exactly like a model that underperformed.

## Context isolation — the fetch lists

Enumerate fields explicitly. "The whole item" is not an answer.

| Role | Fetches | **Must not fetch** |
| --- | --- | --- |
| Planner | | previous failed plans |
| Implementer | | epic task list, sibling items |
| Reviewer | | **the change proposal's description** |
| Fixer | | already-answered verdicts |

## Quality gates

| Gate | Building it? | Override marker | Notes |
| --- | --- | --- | --- |
| Test ratchet | ☐ | `test-removal-approved` | |
| Validation-before-ready | ☐ | — | |
| Red gate | ☐ | `characterization-test` | |
| Base-branch scheduled run | ☐ | — | |
| Deterministic-first lint fixer | ☐ | — | |

How does a human override, in exact steps? (If it is "add the marker, then
re-run the job", confirm the failure message says so.)

> Answer:

## Toolchain adapter

The language/engine-specific commands. Everything above should call these,
never the tool directly.

| Operation | Command | Notes |
| --- | --- | --- |
| install toolchain | | |
| validate / typecheck | | |
| lint | | |
| format (deterministic, no model) | | |
| run tests | | |
| count tests + assertions | | for the ratchet |
| smoke test | | |
| package / export | | |

Which file extensions or paths does an automated path handle **badly**?
(Binary formats, generated assets, anything with unresolvable merge
conflicts.) These earn the ⚠️ flag at plan time.

> Answer:

## Invariant check

Confirm the port holds all seven, from
[`reference-architecture.md`](reference-architecture.md#invariants--do-not-trade-these-away):

- [ ] Each role is a separate session
- [ ] Constraints are capabilities removed, not instructions added
- [ ] The handoff is an artifact a cold session can read
- [ ] Control-plane state is derived, never stored twice
- [ ] Vendor differences live in exactly one file
- [ ] A truncated session never publishes a verdict
- [ ] Model spend on a new decision requires a human tap

Any box unchecked, name it and say why it was traded:

> Answer:
