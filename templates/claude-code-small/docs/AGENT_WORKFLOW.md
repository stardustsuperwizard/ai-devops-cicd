# Development workflow: plan → build → review

How work moves from an idea to a merged change. Agent sessions plan, build and review; a person decides and merges.

This follows the **small-project profile** of [ai-devops-cicd](https://github.com/stardustsuperwizard/ai-devops-cicd): a few firm rules, and everything else adopted only when something actually breaks. Rule IDs in brackets (e.g. [CTX-3]) refer to its `RULES.md`. Where this repository knowingly does something else, it's listed under [Known deviations](#known-deviations).

## The five firm rules

These protect the goals directly. Everything else here is negotiable.

| Rule | Why |
|---|---|
| **Tasks fit one session and pass the cold-start test** [HND-2, HND-3] | Small tasks are the main lever on both cost and quality. A cheaper session succeeds on a small task; a sprawling one drifts. |
| **Review is a separate session that can't edit and never reads the author's account** [DEC-2, CAP-1, CTX-3] | An agent marking its own work isn't review. A PR description is written to persuade. |
| **Deterministic checks run before any model** [GAT-9] | Tests, linters and type checkers are free and exact. Never spend a session on what they catch. |
| **Correction rounds are capped at three** [HUM-3] | By round three the cause is a bad task or a missing decision, which no amount of trying fixes. |
| **A human merges** [MRG-1, MRG-6] | Everything before merge is agents judging agents. |

## Where things live

| What | Where | Why there |
|---|---|---|
| **Live state:** in flight, next, blockers, decisions waiting | **Project status** issue, labeled `status`, pinned | Checkboxes, links, phone notifications. Only "now" matters. |
| **Work:** ideas and tasks | Issues, from the templates | One contract per unit of work. |
| **Knowledge:** rules, design, how the code fits | `AGENTS.md` and the design docs it names | Versioned with the code and reviewed in PRs, so a session on any commit reads docs that match it. |
| **Decisions and their reasons** | `docs/decisions/NNNN-*.md` | Stops settled questions being re-argued. |
| **Role instructions** | `docs/agents/{planner,implementer,reviewer,fixer}.md` | One canonical copy; `.claude/commands/` are one-line stubs pointing here. |

**The rule connecting the issue and the docs:** when a decision is made in the status issue or any discussion, the PR that implements it writes it into the docs. Sessions read the status issue's **body**, which the owner curates. Comments are discussion, not instructions [SEC-5].

## The stages

```
idea issue ──plan──▶ task issue(s) ──implement──▶ PR ──CI──┐
             (Actions   agent-ready    (session              ├──review──▶ verdict ──fix──▶ ⟲ (max 3)
             + owner)                   or Copilot)          │  (Actions)    │
                                                             │               ├─ planning failure → back to plan
                                                             │               └─ design ambiguity → owner decides
                                     green CI + PASS + human check (if labeled) ──▶ a person merges
```

Every stage starts with a **human act** [HUM-1]: a label, an assignment, or a slash command.

| Stage | Start it with | Runs as | Reads | Writes |
|---|---|---|---|---|
| **Plan** | `run:plan` label on the issue, then `run:plan-approve` | GitHub Actions, **read-only** session | The issue body and the owner's comments; the code | A validated plan comment; on approval, task issues |
| **Implement** | `/implement <issue>`, or assign the issue to Copilot | Claude Code session, or Copilot's coding agent | **One** task issue [CTX-4] | A branch and a PR that `Closes #N` |
| **Review** | `run:review` label on the PR | GitHub Actions, **read-only** session | Task issue, diff, CI results. **Not** the PR body [CTX-3] | Verdict comment, one `review:*` label, the `review` status, a comment-type PR review |
| **Fix** | `/fix <PR>`, or `@copilot` on a Copilot PR | Claude Code session, or Copilot | The latest verdict only [CTX-5]; the diff | Commits on the same branch |

**Models: record, don't route.** Use the default model for building and the strongest available for planning and review. Every Actions comment carries a hidden `agent-session` record (model, outcome, cost, turns). Don't build per-task model routing until those records show a class of task that keeps failing at the default.

### Plan

- **Sizing:** one PR a reviewer can read in one sitting; one area, or a thin slice through several; every acceptance criterion provable without asking the owner; no "decide how X works" inside the task.
- **Definition of ready**, checked before `agent-ready` [HND-4]:
  - [ ] Goal, scope, expected files, acceptance criteria and out of scope are filled in.
  - [ ] Each criterion names its proof: a test, a command's output, a screenshot.
  - [ ] Every dependency is merged, or listed and blocking.
  - [ ] Flags work an agent can't do unattended, such as editing `.github/workflows/` or repository settings [SEC-2].
- The planner states the decisions it made rather than asked, so the owner can overrule them before approving.

### Implement

- One task issue, read cold. Runs the validate command before opening the PR [INT-4].
- **Discovered other work** goes in the PR under *Not done*, never into the diff.
- **With Copilot:** assign the issue to Copilot. It reads `AGENTS.md` and the implementer role, works in the environment from `.github/workflows/copilot-setup-steps.yml`, and opens a PR from a `copilot/…` branch. If CI shows *awaiting approval* on its PR, approve the run. Then add `run:review`.

### Review

The reviewer compares the diff against the task's acceptance criteria. It does **not** review style for its own sake.

| Verdict | Means | Next |
|---|---|---|
| `PASS` | Every criterion met; nothing out of scope or unsafe | Human check if labeled, then merge |
| `FIX` | The work is wrong; the task was right | Fix (round count +1) |
| `PLANNING FAILURE` | The task couldn't be built as written, or the PR doesn't close exactly one issue | Back to plan. **Never** to fix |
| `DESIGN AMBIGUITY` | Needs a decision nobody has made, or the fix cap was reached | The owner |

**A broken run is never silent** [GAT-4, INT-5]: if a step fails before the verdict or plan is published, a last step comments with the run log link and, on a PR, sets the `review` status to `error`.

The verdict comment's format is fixed (see `docs/agents/reviewer.md`). A comment missing the end marker or any section is **truncated and not a verdict** [OUT-5], however confident its first line.

Each verdict is also posted as a **comment-type PR review**, so it shows in the Reviews panel. It never *approves* (a machine verdict must not count as approval [MRG-1, MRG-3]) and never *requests changes* (a bot's block would need dismissing). On a Copilot PR, a `FIX` review also asks `@copilot` to act; whether Copilot answers a bot's review is untested. Copilot's own review request is answered by a person: approve after a `PASS`.

### Merge

A person merges, after: CI green, latest verdict `PASS`, and a human check if labeled `needs-human-check`. Squash: one task, one commit [MRG-4].

## Tickets or a focused session?

Tickets win once a feature area's **seams are frozen**: the remaining work is additive against a stable contract. Before that, a cold task can't design the contract, and tickets stall. Changing a core contract is one focused session, planned first, one PR, docs updated. The status issue tracks which areas are ready.

## Labels

Created by **Actions → Bootstrap labels** from `.github/labels.json` [DSP-8]. **Rerun it whenever `labels.json` changes**: a label applied before it exists is created on the fly, grey and undescribed. **Trigger** labels start a workflow, which removes them first, so adding one again is a clean retry [DSP-2]. **State** labels describe what's true.

| Label | Kind | Meaning |
|---|---|---|
| `run:review` · `run:plan` · `run:plan-approve` | trigger | Review this PR · plan this issue · create the planned tasks |
| `plan:proposed` · `plan:needs-decision` · `planned` | state | Where the issue's plan stands |
| `idea` · `agent-ready` | state | Not decided · passed the definition of ready |
| `review:pass` · `review:fix` · `review:planning-failure` · `review:design-ambiguity` | state, exactly one | Latest verdict [DSP-5] |
| `needs-human-check` | state | A person should try it before merging |
| `status` | state | Marks the Project status issue |
| areas from `.github/agents.json` | state | One per task issue |

## Known deviations

Deliberate, with their cost [HUM-6]. These are the ones a small repository usually starts with; delete those that don't apply.

| Rule | What we do instead | Cost, and when to revisit |
|---|---|---|
| **MRG-2** protection is configured | <!-- ADAPT --> e.g. no ruleset: private repository on GitHub Free | Nothing *enforces* green-before-merge. |
| **MRG-1** human approval | Claude sessions open PRs as the owner, who can't approve their own PRs, so the merge is the human act. Copilot PRs have their own author and can be approved. | Revisit with a bot identity for Claude sessions. |
| **MRG-3 / MRG-6** writing identity can't approve or merge | `.claude/settings.json` denies the merge, approve and auto-merge tools | Settings, not credentials. |
| **CAP-1, CTX-3** for interactive review | Enforced only by the `run:review` workflow; interactive `/review` is told not to read the PR body | Use the label for any review you merge on. |
| **SES-5** model fallback list | One model per role (repository variable), no fallback | A busy model fails the run instead of quietly using a cheaper one. |
| **CTX-4** one work item | Implementers can see other issues; they're told to read one | Review checks scope against the task. |
| **CTX-5** a fix reads only the latest verdict | `@copilot` sees the whole PR thread; it's told to answer only the latest verdict | Use `/fix` if it reopens settled points. |
