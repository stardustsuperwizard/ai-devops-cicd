# Capability removal

**The fix is not better prose. It is removing the capability.**

This is the most load-bearing finding in the framework, and it is worth
stating the failure it came from.

## The failure

A planner role was given a profile that said, in several ways, *do not
implement anything; produce a plan*. It implemented things. Repeatedly.

The reason is structural, not a model deficiency. A cloud coding agent's
harness is built to produce a diff: it opens a branch, it opens a change
proposal, and every scaffolding decision inside it pushes toward committing
something. A profile that says "do not implement" is arguing with the harness
— and the harness is not a participant in the argument. It is the environment.

Rewriting the instruction more firmly does not change the outcome. Nothing
written in the prompt outranks what the surrounding machinery is built to do.

## The fix

Run the role somewhere tools can be taken away, and take them away.

```
# read-only posture: the role can read the repository and nothing else
--excluded-tools "bash,powershell,apply_patch,create,edit,task,write_agent"
```

A planner with no `edit` tool does not implement features. Not because it
decided not to — because the call fails.

## Where it applies

| Role | Posture | Why |
| --- | --- | --- |
| Planner | **read-only** | Writing code is the failure mode it is prone to |
| Reviewer | **read-only** | A reviewer that can edit will fix instead of reporting, and its verdict becomes a description of work it just did |
| Implementer | write | Writing code and committing is the job |
| Fixer | write | Same, bounded to one verdict |
| Triage / classifiers | **read-only** or no checkout at all | They turn text into work items; they have no business in the tree |

Sub-agent spawning (`task`, `write_agent` or your surface's equivalent) is
excluded in **both** postures. A role that can spawn sub-agents has escaped
its tool list and its cost tier in one move.

## The trap: additive and subtractive harnesses are opposites

This is the detail that makes a naive abstraction fail silently.

| Harness style | Default | The knob |
| --- | --- | --- |
| **Subtractive** | Starts able to do everything | A deny-list takes capability away |
| **Additive** | Starts able to do nothing | An allow-list grants capability |

A caller that says *"exclude nothing but sub-agents"* means **"you may
edit."** Hand those same words to an additive harness and they mean **"you may
do nothing at all"** — because the allow-list is empty.

The role then runs, writes no code, and produces a session that is
**indistinguishable from a model that underperformed.** You will spend a day
tuning a prompt that was never the problem.

### So: expose one semantic knob, not a pass-through

Your session runner should take `capability: read-only | write` and encode
what that means per harness, in one file, where the two case statements can be
read side by side.

Do **not** expose the underlying tool flags to callers. The moment two callers
spell the same intent differently, you have two postures that drift.

Make `read-only` the **default**, because it is the fail-safe one: a caller
that forgets gets a session that cannot change the checkout, rather than one
that can.

Adding a third posture means editing those two case statements. That is the
correct amount of friction.

## Corollary: enforce at the source, not in the prompt

Capability removal generalises past tool lists. Any constraint you can enforce
by *not supplying something* beats the same constraint written as an
instruction:

- A reviewer that must not read the implementer's self-description: **do not
  fetch that field** when assembling the prompt. (See
  [`04-context-isolation.md`](04-context-isolation.md).)
- A planner that must not touch repository files: give it no checkout write
  access, and validate its output as structured data instead.
- A session that must not exceed a scope: give it one work item, not the epic.

Each of these was prose first and broke. Each works now because the thing it
forbade is absent rather than discouraged.

## How to tell whether you have done it

Ask: *if the model decided to ignore this instruction, what would stop it?*

If the answer is "the instruction", you have not removed a capability. You have
written a wish.
