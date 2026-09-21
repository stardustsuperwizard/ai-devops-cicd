# Substrate worksheet

Copy this file into your project and fill it in **before writing any code**.
Phase 0 of [`build-guide.md`](build-guide.md) is complete when every row has an
answer and every gap has a named degradation from
[`../architecture/02-substrate.md`](../architecture/02-substrate.md#degradations).

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

## The eight capabilities

| # | Primitive | Our implementation | Present? | Degradation if not |
| --- | --- | --- | --- | --- |
| S1 | Work item | | ☐ | |
| S2 | Hierarchy (parent ↔ child) | | ☐ | |
| S3 | Dependency ("A blocks B"), queryable | | ☐ | |
| S4 | Mutable marker | | ☐ | |
| S5 | Marker-change event | | ☐ | |
| S6 | Session runner | | ☐ | |
| S7 | Change proposal | | ☐ | |
| S8 | Durable comment | | ☐ | |

### The two questions that are never obvious

**Can a non-admin set a trigger marker from a mobile client, in two taps?**

> Answer:

If no, the pipeline is not operable from a phone, and that is the property
that makes marker-driven dispatch worth building. Reconsider S4 before continuing (**DSP-1**).

**What may your automation identity not do?** (**HUM-4**)

> Answer:

There is always something — usually modifying its own configuration. That work
is undispatchable by any automated path, so plan-time detection must exist from
the start; otherwise the *ready to dispatch* instruction is wrong for exactly
the items where being wrong is most expensive.

## Runtimes

| runtime name | program | credential | billed to | budget unit |
| --- | --- | --- | --- | --- |
| | | | | |
| | | | | |

Ship phase 3 with one runtime and phase 4 with the second. If you will only
ever have one, **still build the runtime parameter** — it costs one branch in
one file, and it is the seam that keeps everything above it blind (**SES-1**).

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
| Runtime A flags | | |
| Runtime B flags | | |

Is each runtime **additive** or **subtractive**? (**CAP-3**)

> Runtime A:
> Runtime B:

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

The language- and tool-specific commands. Every component above calls these,
never the tool. Drawing this boundary on day one is what makes the rest of the
pipeline portable; retrofitting it is a rewrite.

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

Confirm the build holds the load-bearing six, from
[`../../RULES.md`](../../RULES.md#conformance):

- [ ] **DEC-1** Roles are lifecycle stages, not disciplines
- [ ] **DEC-2** Each role runs as its own session
- [ ] **CAP-1** Constraints are capabilities removed, not instructions added
- [ ] **CTX-1** Isolation is enforced by not fetching
- [ ] **HND-1** Every stage boundary is a durable artifact
- [ ] **HND-3** Work items pass the cold-start test

Then run the full self-assessment in
[`../architecture/04-conformance.md`](../architecture/04-conformance.md).

Any box unchecked, name it and say why it was traded:

> Answer:
