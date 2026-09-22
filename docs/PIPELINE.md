# Building a pipeline that develops software with agents

The whole thing, end to end: intake → plan → implement → integrate → review →
correct → merge. Agent roles are stages inside it; CI and merge policy are the
constraints on them.

This is the guide to read first. [`../RULES.md`](../RULES.md) is what it cites,
[`architecture/`](architecture/) is the abstract model beneath it, and
[`../templates/github-actions/`](../templates/github-actions/) is a working
instance of it.

---

## The thesis

An agentic pipeline does not change what good engineering practice is. It
changes **which parts of it are load-bearing**, because it breaks three
assumptions that conventional practice quietly rests on.

| Conventional assumption | What agents do to it |
| --- | --- |
| Changes arrive at a rate humans can review carefully | Volume rises; attention per change falls |
| The author understood the surrounding system | The author read one work item and nothing else |
| Review is independent of authorship | The reviewer is the same kind of process as the author |

Each of those has a counterweight, and they are the spine of this guide:

- **Volume** → the contract is checkable, so review is a comparison rather
  than a judgement call.
- **Narrow context** → automated gates catch what a narrow author cannot know
  they broke.
- **Non-independent review** → **merge policy** — the one place a human is
  structurally required.

That last one is the most important sentence here. Everything upstream is
agents judging agents. It is worth a great deal and it is **not oversight**.
Merge policy is where that stops being sufficient — see
[MRG-1](../RULES.md#mrg-1--a-machine-verdict-is-never-sufficient-to-merge--must).

---

## The shape

```
                      ┌─────────────────────────────────────────┐
  a human files ─────▶│  INTAKE ITEM                            │
                      └────────────────┬────────────────────────┘
                     a human sets a marker
                                       ▼
                      ┌─────────────────────────────────────────┐
                      │  PLAN          read-only · strong tier  │
                      └────────────────┬────────────────────────┘
                              structured plan
                                       │  ◀── validated before anything exists
                                       ▼
                      ┌─────────────────────────────────────────┐
                      │  TASK ITEMS    each one a cold contract │
                      └────────────────┬────────────────────────┘
                     a human sets a marker
                                       ▼
                      ┌─────────────────────────────────────────┐
                      │  IMPLEMENT     write · per-item tier    │
                      └────────────────┬────────────────────────┘
                              change proposal
                                       │
              ┌────────────────────────┴────────────────────────┐
              ▼                                                 ▼
  ┌───────────────────────┐                       ┌─────────────────────────┐
  │  CONTINUOUS           │                       │  REVIEW                 │
  │  INTEGRATION          │                       │  read-only · strong     │
  │                       │                       │                         │
  │  validate             │                       │  diff vs. acceptance    │
  │  lint the pipeline    │                       │  criteria               │
  │  test ratchet         │                       └───────────┬─────────────┘
  │  red gate             │                                   │
  │  ─────────────        │                        ┌──────────┼──────────┐
  │  ONE aggregate check  │                        ▼          ▼          ▼
  └───────────┬───────────┘                      PASS       FIX     contract
              │                                    │          │      is wrong
              │                                    │          ▼          │
              │                                    │   ┌────────────┐    │
              │                                    │   │  CORRECT   │    │
              │                                    │   │  capped ↑  │    │
              │                                    │   └─────┬──────┘    │
              │                                    │         └──⟲        │
              │                                    │                     │
              └────────────────┬───────────────────┘          back to PLAN
                               ▼
                   ┌────────────────────────────┐
                   │  MERGE                     │
                   │  green aggregate  AND      │
                   │  a human approval          │ ◀── the pipeline
                   │  a human acts              │     cannot do this
                   └────────────────────────────┘
```

Two planes. The **control plane** produces change proposals; the
**verification plane** decides whether they are true. Keep them separate:
nothing in the verification plane may be written, configured, or approved by
the control plane.

---

## Stage 0 — Before anything runs

Three things, and skipping any of them fails silently rather than loudly.

**The marker vocabulary.** Every trigger keys on a *name*. Until the
vocabulary exists, every stage is inert — no error, no log, nothing to find,
and the silence reads as "not triggered yet" for as long as it takes someone
to guess. Ship an idempotent bootstrap and run it first.
→ [DSP-8](../RULES.md#dsp-8--markers-are-created-before-the-pipeline-is-believed-to-work--must)
· [`bootstrap-labels.sh`](../templates/github-actions/.github/scripts/bootstrap-labels.sh)

**The toolchain adapters.** Four files that are the *only* place your language
and tools appear. Everything else calls these, never your tools.

| Adapter | Answers |
| --- | --- |
| [`project-validate.sh`](../templates/github-actions/.github/scripts/project-validate.sh) | Is this checkout green? |
| [`setup-toolchain/`](../templates/github-actions/.github/actions/setup-toolchain/action.yml) | Install what that needs |
| [`format-code/`](../templates/github-actions/.github/actions/format-code/action.yml) | Deterministic formatting, and the lint residue it cannot fix |
| [`suite-log.sh`](../templates/github-actions/.github/scripts/suite-log.sh) | Run the suite against an arbitrary tree |

**Draw this boundary on day one.** It is why ~90% of a control plane built
for one language ports to another by editing strings. Retrofitting it into
workflows that shell out to your build tool inline is a rewrite.
→ [INT-4](../RULES.md#int-4--the-same-validation-runs-locally-in-ci-and-in-the-agent-session--must)

**The repository conventions file.** Whatever your agent runtime reads on
startup — coding standards, architecture commitments, what never to do. It is
context every session gets for free, and the cheapest place to prevent a
class of mistake.

---

## Stage 1 — Intake

A human files an item describing a goal, not an implementation.

Use **structured templates**, because the template is where the cold-start
contract is enforced for free — a field that must be filled is a question
nobody has to remember to ask.
→ [`ISSUE_TEMPLATE/`](../templates/github-actions/.github/ISSUE_TEMPLATE/)

Separate intake **types**, because they need different questions and
different review expectations. Feature, bug, infrastructure, and —
specifically — **dependency**: "add a dependency" is a supply-chain decision
wearing the costume of a small code change, and it is one an agent will make
casually. → [SEC-6](../RULES.md#sec-6--dependency-changes-are-a-distinct-kind-of-work-item--should)

---

## Stage 2 — Plan

**Capability: read-only. Tier: strongest.**

Planning is where the expensive mistakes are made, and the planner allocates
every other role's budget. The role that allocates tiers should not be cheaper
than what it allocates.

It has **no edit capability**. Not "instructions not to implement" — no
capability. A coding harness is built to produce a change, and a prompt
arguing with the harness loses.
→ [CAP-1](../RULES.md#cap-1--constraints-are-enforced-by-removing-capability--must)
· [why](rationale/02-capability-removal.md)

It emits **structured data**, which is validated before a single item is
created. A plan that would create unexecutable items creates **none**, loudly
— partial creation leaves a backlog someone cleans up by hand, in which the
bad items look exactly like the good ones.
→ [HND-4](../RULES.md#hnd-4--planning-output-is-structured-and-validated-before-it-materializes--must)
· [the validation gates](architecture/03-interfaces.md#i2a--the-planners-structured-output)

### What a task item must contain

This is the contract, and the whole pipeline is only as good as it.

> **The cold-start test:** could someone who has read **only this item** do
> the work and know when they were done?

Objective · scope · expected changes · constraints · **acceptance criteria** ·
out of scope · dependencies · model tier.

Acceptance criteria are the field everything hinges on — they are what review
compares against, and what makes "done" a fact rather than an opinion.

- ✅ "`resolve()` returns `null` for an unknown key rather than raising."
- ❌ "Works correctly."

The planner also flags, from the declared scope, work **no automated identity
can perform** — typically anything modifying the pipeline's own configuration.
Discovered at dispatch, that failure lands at the *push*, after a full session
has been paid for and produced complete work.
→ [SEC-2](../RULES.md#sec-2--work-an-automated-identity-cannot-perform-is-known-at-plan-time--must)

---

## Stage 3 — Implement

**Capability: write. Tier: per item, set by the planner.**

The session gets **one** task item. Not the parent's task list, not siblings —
an implementer that can see its siblings will helpfully do two of them, and
the diff no longer matches any contract.
→ [CTX-4](../RULES.md#ctx-4--an-implementing-role-sees-one-work-item--must)

It runs the **same validation** a contributor runs locally and CI runs on the
proposal. Three copies drift, and the one that drifts is the one the agent
trusts — so it reports success against a weaker standard than the gate
applies.

Then two practices that are ordinary engineering hygiene and become
load-bearing here:

**Formatting is applied, never checked.** A pipeline that fails a build over
whitespace burns an entire agent round on something a tool fixes for free —
and the agent's fix is frequently worse than the tool's.
→ [GAT-9](../RULES.md#gat-9--deterministic-tooling-runs-before-any-model--must)

**Readiness is asserted by validation, not by the session's own report.** A
proposal is marked ready only if validation actually passed; one that failed
stays draft and carries an explicit marker. Without that marker, "finished and
broken" is indistinguishable from "still working", and files itself under
*in progress* forever.
→ [GAT-10](../RULES.md#gat-10--readiness-is-asserted-by-validation-not-by-a-sessions-report--must)

The session **does not push**. It commits locally; the workflow pushes. What a
session produced should be inspectable before it leaves the runner, and a
credential inside a session is a credential in a transcript.
→ [SEC-3](../RULES.md#sec-3--an-agent-session-never-holds-a-publishing-credential--must)

---

## Stage 4 — Continuous integration

Ordinary CI, with two additions that exist specifically because an agent wrote
the change.

→ [`ci.yml`](../templates/github-actions/.github/workflows/ci.yml)

### One aggregate check

However many jobs run, exactly **one** aggregate reports, and that is what
merge policy requires. A required-check list enumerating individual jobs
drifts the moment someone adds a job — and the drift is invisible: the new job
runs, can fail, and merges anyway.
→ [INT-1](../RULES.md#int-1--one-aggregate-check-is-what-merge-policy-names--must)

### Triggers unfiltered; filtering inside the jobs

A workflow skipped by a path filter reports **no status at all**, so proposals
hang forever waiting for a check that will never arrive. A job skipped by a
condition reports "skipped", which counts. So gate the jobs, never the
trigger. → [INT-2](../RULES.md#int-2--verification-triggers-are-unfiltered-filtering-lives-in-the-jobs--must)

### Scope decisions fail safe

Deciding which expensive checks to run is a **deny-list** of paths that
provably cannot break the build — never an allow-list of paths that can. An
allow-list fails unsafe: add a source directory, and verification silently
stops covering it. → [INT-3](../RULES.md#int-3--scope-decisions-fail-safe--must)

### The two agent-specific gates

A human who deletes a failing test knows they did it. An agent optimising for
a green check does it as the cheapest available move, in a diff too large for
anyone to notice.

**The test ratchet** — test and assertion counts may not fall. Override with
an explicit human marker and a recorded reason.
→ [GAT-2](../RULES.md#gat-2--test-and-assertion-counts-may-not-fall--should)

**The red gate** — a test this change adds must have **failed** against the
pre-change code. A new test that passes before the change verifies nothing.
→ [GAT-1](../RULES.md#gat-1--a-new-test-must-have-failed-against-the-pre-change-code--should)

Both need three properties that are easy to get wrong:

| Property | Why |
| --- | --- |
| **"Wrong" ≠ "could not decide"** | Blurring them means a broken gate looks like an approved exception, and stays that way for months |
| **Override read live, not from a replayed event** | Re-runs replay the original payload, so a marker set *after* a failure is invisible to the re-run meant to see it |
| **The failure message states its own override procedure** | Nobody remembers "set the marker, *then* re-run" |

### Verify the commit the agent actually pushed

Do not rely on a proposal-triggered run firing for an automated push. Those
frequently land in a state requiring manual approval and never execute — so
nothing independent ever measures those commits, while the proposal looks
checked. → [INT-6](../RULES.md#int-6--verification-runs-on-the-commit-the-agent-actually-pushed--must)

### Lint the pipeline itself

The workflows are code. Lint them, test their logic, and pin any third-party
tool that runs on your repository by version **and checksum** — an unpinned
tool running on every change is a supply-chain hole with the widest possible
blast radius. → [INT-8](../RULES.md#int-8--third-party-tooling-is-pinned-by-version-and-checksum--must)

---

## Stage 5 — Review

**Capability: read-only. Tier: strongest.**

It compares the diff against the acceptance criteria. That comparison is only
possible because stage 2 made the criteria checkable.

**The reviewer does not receive the implementer's description of its own
work.** That text was written to be persuasive; a reviewer reading it checks
the account rather than the diff. Enforced by **not fetching the field** —
prose asking it to disregard what is already in the window does not hold.
→ [CTX-3](../RULES.md#ctx-3--a-reviewing-role-never-receives-the-reviewed-roles-account--must)
· [why](rationale/04-context-isolation.md)

It has no edit capability, for the same reason the planner does not: a
reviewer that can fix will fix, and its verdict becomes a description of work
it just did.

### Four verdicts, not two

| Verdict | Means | Routes to |
| --- | --- | --- |
| **PASS** | Meets the criteria | Merge policy |
| **FIX** | The work is wrong; the contract was right | The correction loop |
| **PLANNING FAILURE** | The item was unexecutable as written | **Planning.** A fixer cannot help |
| **DESIGN AMBIGUITY** | Underspecified in a way needing a decision | **A human.** No model supplies a missing decision |

Collapsing to pass/fail is the most expensive simplification available:
contract failures enter the correction loop, burn every escalation round, and
produce nothing. → [OUT-6](../RULES.md#out-6--verdicts-distinguish-where-the-fault-lies--must)

### A truncated session never publishes a verdict

The verdict line comes first, which makes truncation the *dangerous* case
rather than the obvious one: **a review cut off halfway through its criteria
table still says it passed.** So publication gates on how the session ended
before believing anything it said.

Without this, the review stage is theatre — and silently so.
→ [OUT-5](../RULES.md#out-5--a-truncated-session-never-publishes-a-verdict--must)

---

## Stage 6 — Correct

**Capability: write. Tier: middle, escalating one tier per round.**

Bounded to the verdict it is answering. Not a re-implementation.

**Cap it at three rounds.** Round 1 is the cheap explanation — the fixer
misread. By round 3 the cause is almost always an underspecified item or a
wrong design, and neither is fixed by a better model trying harder. The
correct next model is a person.
→ [HUM-3](../RULES.md#hum-3--correction-attempts-are-capped--must)

Every round re-enters stage 4. A correction that has not been re-verified is
an unverified change.

---

## Stage 7 — Merge

**This stage is not automatable, and that is the point.**

Everything before it is agents judging agents. Merge is where independent
authority enters, and it enters structurally — in branch protection, not in a
document asking people to be careful. Under deadline pressure, with a green
board and a queue of agent-authored proposals, a convention loses.

| Requirement | Rule |
| --- | --- |
| Green aggregate check **and** a human approval | [MRG-1](../RULES.md#mrg-1--a-machine-verdict-is-never-sufficient-to-merge--must) |
| Enforced by the platform, not by convention | [MRG-2](../RULES.md#mrg-2--merge-protection-is-configured-not-conventional--must) |
| The identity that writes code cannot approve it | [MRG-3](../RULES.md#mrg-3--the-identity-that-writes-code-cannot-approve-it--must) |
| Merging is a human act; no role may merge | [MRG-6](../RULES.md#mrg-6--merging-is-a-human-act--must) |
| Ownership requirements apply to agent changes identically | [MRG-7](../RULES.md#mrg-7--ownership-requirements-apply-to-agent-authored-changes-identically--must) |

MRG-3 is CAP-1 applied to the merge gate: remove the capability rather than
instructing the agent not to use it. An agent that *can* approve its own
change eventually will, helpfully, as the last obstacle to a green board.

**One work item → one proposal → one commit.** Squash on merge. The commit
becomes a unit of revert matching a unit of *intent* — which matters more with
agents than without, because agent-authored changes are reverted more often
and reviewed less deeply, and a revert mapping exactly to one work item is one
you can take quickly and safely.
→ [MRG-4](../RULES.md#mrg-4--one-work-item-one-proposal-one-commit--should)

---

## Stage 8 — Observe

**Derived state, never stored.** Every status is computed from the tracker's
own graph at render time. Stored status is a second source of truth, and a
failed write leaves it wrong while looking right. A failed render leaves it
stale — visibly, with a timestamp — which is always the safer failure.
→ [OBS-1](../RULES.md#obs-1--control-plane-state-is-derived-never-stored--must)

**A ledger of every session**: role, tier, model *actually used*, outcome,
duration, cost, round. Keep tier and model separate — when they differ, a
fallback fired, and a ledger recording only the model cannot tell you that
work tiered up was done cheaply.

Two questions nothing else can answer:

- **Which role fails most, at which tier?** Distinguishes a tier set too cheap
  from work items written badly. Opposite fixes; guessing wrong costs weeks.
- **What does one completed item cost, including the rounds that failed?** The
  only honest number.

**Know whether the baseline is already broken.** Run the full suite against
the integration branch on a schedule. Without it you cannot distinguish "this
change broke it" from "it has been broken since Tuesday", and you will spend
correction rounds on neither.
→ [GAT-11](../RULES.md#gat-11--know-whether-the-baseline-is-already-broken--should)

---

## Build order

Each step is independently useful and independently verifiable. Detail in
[`adaptation/03-procedure.md`](adaptation/03-procedure.md).

| | Build | Done when |
| --- | --- | --- |
| 1 | **Merge policy and CI** — protection rules, the aggregate check, validation | You cannot merge red, and you cannot merge unapproved |
| 2 | **The adapters** | One script answers "is it green?", everywhere |
| 3 | **Marker vocabulary + bootstrap** | Delete it all, re-run, still operable |
| 4 | **The echo job** — a marker produces a run that prints an ID | Boring. Five times in a row |
| 5 | **The session runner** | A `read-only` session cannot write a file |
| 6 | **A second runtime** | Nothing above the session runner changed |
| 7 | **Review** — read-only, so it cannot damage anything | A truncated review publishes a failure, not a pass |
| 8 | **Implement** | A failed validation leaves a draft with a marker |
| 9 | **Plan** | A task item passes the cold-start test with a real person |
| 10 | **Correct + the cap** | Round 4 escalates to a human |
| 11 | **The agent-specific gates** | Deleting a test fails the build |
| 12 | **Ledger and control plane** | You can answer both ledger questions |

**Merge policy and CI go first**, before any agent runs. They are what makes
everything after them safe to get wrong — and an agent pipeline built onto a
repository that can merge red is a machine for merging red faster.

Review before implement is also deliberate: it is read-only, so it cannot
damage anything while you are debugging dispatch.

---

## What "best practice" means here

Standard practice is not restated in the rules. These are the places where
agents change the answer.

| Practice | Unchanged | What agents change |
| --- | --- | --- |
| Trunk-based development | ✅ | Parallel agents make stacked proposals expensive — one rejected verdict cascades |
| Small, single-purpose changes | ✅ | Now enforced by the contract, not by discipline |
| Tests with the change | ✅ | Must be *proven* to have failed first — an agent writes passing tests by default |
| Code review | ✅ | The agent review is a comparison against criteria; **it is not the independent review** |
| Required status checks | ✅ | Must be **one aggregate**, or the list drifts silently |
| Least privilege | ✅ | Per *role*, not per pipeline — a read-only role holding write scope undoes capability removal |
| Pinned dependencies | ✅ | Agents add dependencies casually; make it a distinct intake type |
| Untrusted input | ✅ | Item bodies and comments now reach a **prompt** with a credential behind it |
| Revert readiness | ✅ | Matters more: reverted more often, reviewed less deeply |
| Documented conventions | ✅ | Now machine-read on every session — the cheapest place to prevent a class of mistake |

The pattern: nothing on this list is new, and every item's *consequence of
neglect* got larger.

---

## Where to go next

| | |
| --- | --- |
| [`../RULES.md`](../RULES.md) | 98 rules, each with why / fails-as / verify |
| [`architecture/04-conformance.md`](architecture/04-conformance.md) | Self-assessment — run it |
| [`../templates/github-actions/`](../templates/github-actions/) | A working instance |
| [`adaptation/`](adaptation/) | Moving it to different tools |
| [`rationale/`](rationale/) | The failures each rule came from |
