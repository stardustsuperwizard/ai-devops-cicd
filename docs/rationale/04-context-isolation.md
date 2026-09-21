# Context isolation

> *Field notes.* This page explains **why** a rule exists — the failure it
> came from. The rule itself is normative and lives in
> [`../../RULES.md`](../../RULES.md); the architecture it serves is in
> [`../architecture/`](../architecture/).
>
> **Rules this justifies:** CTX-1 … CTX-5.

What a role must **not** see is part of its definition, and it has to be
enforced by what the prompt assembler does not fetch.

## The case that proves it

A reviewer judges a diff against a task item's acceptance criteria. The change
proposal also has a **description**, written by the implementer, explaining
what it did and why.

That description is the implementer's account of its own work. A reviewer that
reads it is **checking the account rather than the diff**. It will find the
narrative coherent, because the narrative was written to be coherent, and it
will rate the shortcut the narrative justifies as justified.

So the reviewer does not get it.

### Prose did not work

The first version of this constraint was an instruction in the reviewer's
profile: *do not weigh the change proposal's description; judge the diff.* The
description was still in the assembled prompt, and an instruction not to weigh
it was the only thing between the reviewer and the implementer's narrative.

The fix was to stop fetching the field:

```bash
# assemble the review prompt — note which fields are NOT requested
gh pr view "$PR" --json number,title,headRefName,files,additions,deletions
#                       ^ no `body`
```

Same mechanism as [`02-capability-removal.md`](02-capability-removal.md),
applied to context instead of tools. The constraint is now enforced by an
absence, not by prose a model could be argued out of.

## The general rule

> If a role must not be influenced by X, do not put X in its prompt.

An instruction to disregard something already present is not isolation. It is
a request, and it competes with everything else in the context window.

## What each role should and should not see

| Role | Must see | Must **not** see |
| --- | --- | --- |
| **Planner** | Intake item, repo inventory, architecture docs | Prior failed plans for this epic (it will defend them) |
| **Implementer** | Exactly one task item, project conventions | The epic beyond context framing; sibling task items; the planner's reasoning |
| **Reviewer** | The diff, the task item, acceptance criteria, CI results | The implementer's description of its own work; the implementer's session |
| **Fixer** | The verdict, the diff, the task item | Earlier verdicts already answered (it will re-litigate) |
| **Triage** | Already-written findings text | The code — it is classifying text, not re-deciding |

The epic row for the implementer is the subtle one. Some framing context is
legitimate; the *task list* is not, because an implementer that can see its
siblings will helpfully do two of them.

## Isolation is what makes retry cheap

Because no stage depends on another stage's context, a failed stage is retried
by re-running it against the same durable artifact. There is no state to
reconstruct and no conversation to replay.

That property is worth protecting. Any optimisation that passes context
directly from one stage to the next — "just hand the planner's notes to the
implementer, it's right there" — trades it away, and you will not notice until
the day you need to re-run one stage.

## Auditing your own assembler

For each role, print the assembled prompt and read it as if you were the
model. Then ask:

1. Is there anything here that would let me satisfy the task **without doing
   it** — a previous answer, a narrative, a claim of completion?
2. Is there anything here written by the role I am supposed to be checking?
3. Is there any scope visible that I was not assigned?

Every *yes* is a field to stop fetching.

## The cost, stated honestly

Isolation makes each session dumber about the surrounding work. A reviewer
without the implementer's notes will occasionally flag something the notes
would have explained.

That is the correct trade. A flagged non-issue costs one comment. A review
that rubber-stamps a shortcut because the shortcut came with a good
explanation costs a defect in the codebase, and the whole reason the review
stage exists.
