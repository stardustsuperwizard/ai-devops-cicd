# The handoff contract

> *Field notes.* This page explains **why** a rule exists — the failure it
> came from. The rule itself is normative and lives in
> [`../../RULES.md`](../../RULES.md); the architecture it serves is in
> [`../architecture/`](../architecture/).
>
> **Rules this justifies:** HND-1 … HND-6.

Each stage runs in its own session. No stage sees the previous stage's
reasoning. So the handoff has to be an **artifact a cold session can read**,
and the pipeline is only as good as that artifact.

## There is no plan file

The planner writes no repository files at all — it has no edit capability, for
the reason in [`02-capability-removal.md`](02-capability-removal.md). The
contract lives in the work tracker instead, split across two durable places:

| Artifact | Carries |
| --- | --- |
| **The task item body** | Objective, scope, expected files, architecture constraints, acceptance criteria, out of scope, dependencies |
| **The plan comment on the epic** | Plan summary, architecture notes, the task list with item IDs |

## The task item is authoritative

The implementer is given exactly one task item and never sees the planner's
session. Therefore:

> **Anything an implementer needs must be in the task item body** — not in the
> plan comment, and not in the parent epic.

The parent is context only. It does not expand scope. An implementer that
reads the epic and decides to do a little extra has broken the one property
that makes the pipeline auditable: that the diff can be checked against a
fixed contract.

This is also why the reviewer is given the task item and the diff, and judges
one against the other. If the contract were spread across three documents, the
review would be a judgement call rather than a check.

## The cold-start test

Before a task item is dispatched, ask:

> Could someone who has read **only this item** — not the epic, not the plan
> comment, not any conversation — do the work and know when they were done?

If not, the item is not ready. The commonest failures:

- acceptance criteria that say "works correctly";
- an expected-files list that omits the file the real change lives in;
- a constraint that only makes sense if you read the epic;
- a dependency that is mentioned in prose but not recorded as a link.

## Validate the plan structurally, before creating anything

The planner's output should be **structured data** — JSON, not prose — and the
orchestration should validate it before a single work item is created.

Minimum checks worth failing the run over:

| Check | Why |
| --- | --- |
| Every task has non-empty acceptance criteria | Otherwise it cannot be executed cold or reviewed |
| Every `depends_on` resolves to a task in the same plan | A dangling dependency becomes a permanently blocked item |
| No dependency cycles | Nothing in the epic would ever be dispatchable |
| Every task has a scope and an out-of-scope section | Out-of-scope is what makes review possible |
| Task count is within a sane bound | A 40-task plan is usually a planner that failed to decompose |

Failing the run is correct here. A plan that would create unexecutable items
should produce **no items**, loudly, rather than a backlog someone has to
clean up by hand.

## Which artifacts are durable

An artifact qualifies as a handoff only if it satisfies all three:

1. **It survives the session.** A context window is not an artifact.
2. **It is addressable.** Something downstream can fetch it by ID.
3. **It is readable by a human** who wants to intervene at that boundary.

Comment threads, item bodies, change-proposal descriptions and committed
files all qualify. Session transcripts, in-memory state and chat scrollback
do not.

## Where the contract lives per platform

| Concept | GitHub | Jira + Jenkins | GitLab |
| --- | --- | --- | --- |
| Intake item | Issue with `[epic]` title prefix | Epic | Issue with epic label |
| Task item | Sub-issue with `[task]` prefix | Story / Sub-task | Child issue |
| Plan record | Issue comment | Jira comment | Issue comment |
| Change proposal | Pull request | Branch + PR in the SCM | Merge request |
| Verdict | PR comment + label | Jira comment + status field | MR note + label |

See [`../realizations/jira-jenkins.md`](../realizations/jira-jenkins.md) for the
full mapping and the primitives each one has to supply.

## Tool-agnostic by construction

Because the contract is *acceptance criteria, scope and expected files in the
item body*, any agent CLI can execute it. That is what lets you run the same
task item through a different vendor, a different model tier, or a human,
without rewriting anything.

Keep it that way. The moment a task item says "run `/implementer`", the
contract has acquired a dependency on one tool.
