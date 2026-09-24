# Role design: when a role is real

> *Field notes.* This page explains **why** a rule exists — the failure it
> came from. The rule itself is normative and lives in
> [`../../RULES.md`](../../RULES.md); the architecture it serves is in
> [`../architecture/`](../architecture/).
>
> **Rules this justifies:** DEC-1, DEC-3, DEC-4, DEC-5.

Most agent rosters are org charts — *writer*, *researcher*, *data engineer*,
*UI specialist*. This framework decomposes along a different axis, and the
difference is not cosmetic.

| | Lifecycle pipeline | Org chart |
| --- | --- | --- |
| Axis | Lifecycle stage | Discipline |
| Roles | plan → implement → review → fix | writer, researcher, data, cloud, UI |
| Handoff | A durable artifact | Conversation inside one session |
| Ordering | Fixed; each stage consumes the last one's output | None; disciplines do not queue |

The org chart is not a better-organised pipeline. It is a cut along a
different dimension, and the dimension matters because of **what carries the
handoff**.

Every stage here hands the next one an artifact a cold session can read: the
task item body, the change proposal, the verdict comment. Disciplines have no
such property — a technical writer and a data engineer are knowledge domains;
they do not stand in a fixed order and neither owes the other an artifact. An
org chart of agents therefore keeps its coordination inside one session's
context, which is precisely the thing a durable-artifact pipeline exists to
get away from.

## What actually makes a role work

Not its name. Three mechanisms, in descending order of how much weight they
carry:

1. **Capability removal.** The planner has no edit tool. The reviewer has no
   edit tool. See [`02-capability-removal.md`](02-capability-removal.md).
2. **Cost tiering.** The implementer runs cheap; the planner runs expensive.
   The role that *allocates* the other roles' tiers should not be cheaper
   than what it allocates. See [`05-model-tiering.md`](05-model-tiering.md).
3. **Context isolation.** The reviewer judges the diff against acceptance
   criteria without having read the implementer's account of why a shortcut
   was fine. See [`04-context-isolation.md`](04-context-isolation.md).

**Job title is not one of these.** Two agents that differ only in the prose
describing their expertise get identical tool lists, identical model tiers,
and identical context. That is one agent with two names.

## The test

Split an agent into a new role when at least one of these is true:

- it needs **different tool permissions** from every existing role;
- it belongs on a **different cost tier**;
- it must **not see** context an existing role has.

If none of the three holds, the work belongs to an existing role and the
"new role" is a prompt.

Apply the test honestly in both directions. It is also the argument for
*merging* two roles that have drifted into having the same three answers.

## Why an orchestrator role does not fit

The manager-delegates-to-specialists shape is the most commonly proposed
addition, and on a session-per-role control plane it cannot work. Four
reasons, in order of how hard they are to argue with:

1. **Sub-agent spawning is disabled in every pipeline role**, deliberately, in
   both the read-only and write capability postures. A role that can spawn
   sub-agents has escaped its tier and its tool list.
2. **One session means one model**, covering the parent and every sub-agent.
   A manager delegating in-session runs its cheap specialists on the
   manager's expensive model — the exact outcome tiering exists to prevent.
3. **Declarative delegation is often unsupported** on the surface you are
   targeting. Check before designing around it.
4. **Where it does work, it is not free.** Verify per-sub-agent model routing
   actually takes effect on your CLI version before trusting it; several
   harnesses have shipped with it silently ignored.

An orchestrator is a local, interactive convenience. It does not belong in the
automated control plane without undoing the separation that control plane
exists to provide.

## The empty-role trap

A role with nothing to read and nothing to write is a role that will invent
work. Before adding one, name:

- the **input artifact** it reads, which must already exist;
- the **output artifact** it writes, which something downstream must already
  consume;
- the **failure** that happens today because no one does this.

If the output artifact has no consumer, you have added a step that produces
text nobody reads, on a budget somebody pays.

## Roles worth having, and their gates

| Role | Gate — do not build it until |
| --- | --- |
| Plan reviewer (checks a plan before any task is dispatched) | The planner produces enough tasks per epic that a bad plan is expensive |
| Triage (turns already-recorded deferred findings into work items) | Reviews actually record deferred findings |
| Lint fixer (narrow, deterministic-first self-heal) | A deterministic formatter already runs first and leaves a known residue |
| Release preflight | You cut releases on a cadence a human cannot babysit |

Each of those passes the three-part test on at least one axis. Note what they
have in common: every one of them has a named input artifact that already
exists before the role does.

## Revisiting this

Re-run the test when any of these changes:

- the surface gains or loses per-sub-agent model routing;
- a stage starts failing for reasons the next stage could have caught;
- a role's prompt grows a second mode with a different tool need — that is the
  test telling you to split.
