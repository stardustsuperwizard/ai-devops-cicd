# The model

The abstract machine. No language, no tools, no services — those belong to a
[concrete implementation](../../templates/github-actions/), and the point of
this page is that the architecture does not depend on which you have.

## Entities

**Work item.** The unit of assignable work. Structured text, addressable by a
stable identifier, mutable, with a lifecycle. Every other entity refers to one.

**Marker.** A small mutable attribute on a work item, settable and clearable
independently of the item's text. Three kinds, and the distinction is load
bearing:

| Kind | Set by | Cleared by | Answers |
| --- | --- | --- | --- |
| **Trigger** | A human | The stage it starts | "do this now" |
| **State** | Automation or a human | Whatever makes it untrue | "this is true of this item" |
| **Button** | A human | The action, always | "do it again" |

**Artifact.** Durable, addressable, human-readable text produced by a stage
and consumed by another. Three properties, all required: it survives the
session, something can fetch it by ID, and a human who wants to intervene can
read it. A context window is not an artifact. A chat transcript is not an
artifact.

**Session.** One execution of an agent against one prompt, with one capability
posture, one model, and one budget. Sessions are **ephemeral and isolated**:
a session knows only what its prompt contains.

**Role.** A lifecycle stage. Defined by exactly three things — its **capability
posture**, its **cost tier**, and its **fetch list** (what it sees, and what it
does not). Not by its name.

**Change proposal.** A reviewable body of work: a set of changes, a comment
surface, and its own markers. On most substrates this is a branch plus a
pull/merge request; it does not have to be.

**Substrate.** Whatever you have: a tracker, an automation runner, an agent
runtime, a source control system. The architecture states what it needs from
each; [`02-substrate.md`](02-substrate.md) states what to do when one is
missing.

## The pipeline

Four stages. Each is a separate session. Each hands the next an artifact.

```
  intake item                    ┌──────────────┐
      │                          │              │
      │ trigger                  ▼              │
      ▼                     ┌─────────┐         │
  ┌───────┐   task items    │ IMPLEMENT│        │
  │ PLAN  │───────────────▶ │          │        │
  └───────┘   + plan record └────┬─────┘        │
  read-only                      │ change        │
  strong tier                    │ proposal      │
                                 ▼               │
                            ┌─────────┐          │
                            │ REVIEW  │          │
                            └────┬────┘          │
                       read-only │ verdict       │
                      strong tier│               │
                 ┌───────────────┼───────────────┤
                 │               │               │
            accepted      work is wrong    contract is wrong
                 │               │               │
                 ▼               ▼               └──▶ back to PLAN
             integrate      ┌─────────┐
                            │   FIX   │──────────────▶ (re-review)
                            └─────────┘
                             write, escalating
                                 │
                    needs a decision ──────────────▶ a human
```

| Stage | Capability | Tier | Reads | Writes |
| --- | --- | --- | --- | --- |
| **Plan** | read-only | strong | Intake item; inventory of the existing system | Task items; a plan record |
| **Implement** | write | per-item | **One** task item | Changes; a change proposal |
| **Review** | read-only | strong | The changes; the task item's criteria | A verdict |
| **Fix** | write | middle, escalating | One verdict; the changes | Changes on the same proposal |

Why these four and not others: each differs from every other on at least one
of the three defining properties (`RULES.md` **DEC-3**). *Plan* and *review*
share a posture and a tier but differ completely in what they see. *Implement*
and *fix* share a posture but differ in tier and in input.

A fifth role is justified the moment it differs on one of the three, and not
before.

## Why the stages are separate sessions

A session has **one** model and **one** tool policy. Everything it delegates
to, it delegates at its own cost and its own capability.

So per-role tiering — running planning expensively and mechanical execution
cheaply, which is what makes this affordable — is only achievable by *not
delegating in-session*. The stage boundary is not organisational preference;
it is the only place the cost and capability can actually change.

This is why an orchestrator agent does not fit. In-session it collapses the
tiering. Across sessions it is the dispatcher you already have.

## State transitions

State lives on the work item, as markers, derived from the substrate's own
graph. Nothing stores a status.

```
     ┌─────────────┐  planner    ┌─────────┐
     │ awaiting    │────────────▶│ planned │
     │ planning    │             └────┬────┘
     └─────────────┘                  │ creates
                                      ▼
                            ┌──────────────────┐
                            │ blocked          │◀──── dependency open
                            └────────┬─────────┘
                                     │ dependencies closed
                                     ▼
                            ┌──────────────────┐
                            │ ready to dispatch│
                            └────────┬─────────┘
                                     │ implement
                                     ▼
                     ┌───────────────────────────┐
              ┌──────│ in progress               │
              │      └────────┬──────────────────┘
   validation │               │ validation passed
   failed     ▼               ▼
      ┌──────────────┐  ┌──────────────┐
      │ needs        │  │ awaiting     │
      │ attention    │  │ review       │
      └──────────────┘  └──────┬───────┘
              ▲                │
              │ non-accepting  │ accepted
              │ verdict        ▼
              └──────────  ┌──────────────┐
                           │ ready to     │
                           │ integrate    │
                           └──────────────┘
```

Two orderings in that diagram are not arbitrary, and both are commonly got
wrong:

**"Finished and broken" must outrank "in progress."** If a proposal is marked
ready only once its validation passes, then *unfinished* is no longer the only
reason it sits unready. Without an explicit failed-validation state, a broken
branch files itself under *in progress* forever — the exact quietly-hidden
failure the control plane exists to surface.

**"In progress" must outrank a stale verdict.** A correction round carries the
verdict it is answering for its whole duration. Test in-progress-ness first or
every in-flight fix shows as waiting on a human.

## What flows across each boundary

| Boundary | Artifact | Must contain | Must **not** contain |
| --- | --- | --- | --- |
| intake → plan | The intake item | The goal, constraints, the "why" | An implementation |
| plan → implement | **One task item** | Objective, scope, expected changes, constraints, acceptance criteria, out-of-scope, dependencies, tier | The sibling task list |
| implement → review | The change proposal | The changes themselves | *(the producer's account of them is withheld from the reviewer)* |
| review → fix | The verdict | What is wrong, where, and against which criterion | Earlier answered verdicts |
| review → plan | The verdict | Why the contract was unexecutable | — |
| any → human | The verdict or escalation | The decision needed | — |

The empty cell in row three is the whole of context isolation: the change
proposal's *description* exists, and the reviewer does not receive it. It was
written to be persuasive, and a reviewer that reads it checks the account
rather than the work.

## The two invariants everything else serves

**Constraints are enforced by absence.** If a role must not do something,
remove the capability. If a role must not be influenced by something, do not
fetch it. Instructions compete with everything else in the window; absence
does not compete.

**The handoff is readable cold.** No stage sees the previous stage's
reasoning, so the artifact is the entire contract. This is what makes each
stage retryable, auditable, substitutable, and interruptible — and it is the
first property an optimisation will try to trade away.

## Where humans sit

Every stage boundary is an interruption point: a durable artifact a person can
read, disagree with, and redirect. That is why the boundaries are where they
are, and it is the reason to prefer four cheap sessions over one expensive
one even where the cost were equal.

Three things are structurally not delegable:

- **Starting a session on a new decision.** The trigger is a human act. Narrow
  deterministic-residue work is exempt, with its bound written down.
- **"The contract is wrong."** That is a planning decision.
- **"This needs a decision."** No amount of model supplies a missing one.

## Reading on

| | |
| --- | --- |
| [`01-components.md`](01-components.md) | The seven components and their contracts |
| [`02-substrate.md`](02-substrate.md) | What a substrate must supply; what to do when it does not |
| [`03-interfaces.md`](03-interfaces.md) | The data shapes that cross each boundary |
| [`04-conformance.md`](04-conformance.md) | Levels, and how to self-assess |
| [`../../RULES.md`](../../RULES.md) | The normative rules |
| [`../rationale/`](../rationale/) | Why each rule exists — the failures they came from |
