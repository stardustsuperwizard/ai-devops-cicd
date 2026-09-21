# The pipeline, in one page

An agent development pipeline is four roles, run as **four separate sessions**,
handing each other **durable artifacts**.

```
Intake work item  ──plan──▶  Task work items  ──implement──▶  Change proposal
                                                                    │
                                                              ──review──▶ verdict
                                                                    │
                                                              ──fix──▶ (loop)
```

| Stage | Reads | Writes | Capability |
| --- | --- | --- | --- |
| **Plan** | Intake item, repository inventory | Task items, a plan comment | **Read-only** |
| **Implement** | One task item | Code, a change proposal | Write |
| **Review** | The diff + the task's acceptance criteria | A verdict | **Read-only** |
| **Fix** | The verdict + the change proposal | Code, on the same branch | Write |

Everything else in this repository is a consequence of five properties of
that picture. Each has its own document; this page states them so the rest
can be read in any order.

## 1. Roles are separate sessions, not sub-agents

A single session has a single model, and that model covers the parent and
everything it delegates to. So per-role model routing — the thing that makes
this affordable — requires separate sessions. An orchestrator delegating to
specialists in-session runs the cheap specialists on the orchestrator's
expensive model.

→ [`01-role-design.md`](01-role-design.md),
  [`05-model-tiering.md`](05-model-tiering.md)

## 2. Constraints are capabilities removed, not instructions added

A planner told "do not implement" will implement. A planner with no edit tool
cannot. This is the single most load-bearing finding in the whole framework,
and it was learned the expensive way.

→ [`02-capability-removal.md`](02-capability-removal.md)

## 3. The handoff is an artifact a cold session can read

No stage sees the previous stage's reasoning. The task item body is the entire
contract. If an implementer needs it, it is in the task body — not in the plan
comment, not in the parent epic, not in anybody's context window.

→ [`03-handoff-contract.md`](03-handoff-contract.md)

## 4. What a role must *not* see is part of its definition

The reviewer does not receive the implementer's description of its own work.
Not because it is told to ignore it — because the prompt assembler does not
fetch that field.

→ [`04-context-isolation.md`](04-context-isolation.md)

## 5. State is derived, never stored twice

Every status the control plane displays is computed from the work tracker's
own graph at render time. A failed render shows you yesterday; it never shows
you something false.

→ [`06-state-markers.md`](06-state-markers.md),
  [`07-derived-state.md`](07-derived-state.md)

## The rest

| Document | Question it answers |
| --- | --- |
| [`08-session-outcomes.md`](08-session-outcomes.md) | How do you tell "the model finished and said no" from "the model ran out of budget"? |
| [`09-quality-gates.md`](09-quality-gates.md) | How do you stop an agent from deleting the failing test? |
| [`../porting/reference-architecture.md`](../porting/reference-architecture.md) | What are the platform primitives this needs? |
| [`../porting/platform-mapping.md`](../porting/platform-mapping.md) | What does this look like on Jira + Jenkins? |

## What this is *not*

It is not a multi-agent framework, a prompt library, or an autonomy pitch.
Every stage boundary in the diagram above is a place a human can stop, read a
durable artifact, and change their mind. That is the point of putting the
boundaries there.
