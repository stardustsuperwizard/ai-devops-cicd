# Example: jrpg-battle

A small-project, Claude-only instance of the framework: the **small-project
profile** from [proposal 0002](../../docs/proposals/0002-goals-first-vendor-neutral.md),
built in one day on a plain-JavaScript game. Where gladiator-engine shows the
full system, this shows how little of it a one-person project needs, and which
parts still had to be built properly.

The repository (`stardustsuperwizard/jrpg-battle`) is **private**, so links
into it will not resolve for most readers. Everything below is quoted or
summarised here for that reason.

## Shape

| | |
| --- | --- |
| Project | Turn-based JRPG party battler. Plain ES modules, no build step, no runtime dependencies. About 6,000 lines of game code and tests. |
| People | One owner. Phone and web, no local checkout needed. |
| Agent runtime | Claude Code only. No Copilot, no second vendor. |
| Control plane | ~1,700 lines (two workflows, a self-test, a composite action, `scripts/agents/`, 28 tests) plus ~570 lines of role prompts and workflow docs. gladiator-engine's is about 38,000. |
| Profile | Small: five firm rules, everything else adopted when something breaks. |

## The five firm rules, and how each is held

| Rule | Held by |
| --- | --- |
| **HND-2, HND-3** tasks fit one session and pass the cold-start test | The task issue template and a definition-of-ready checklist; the planner validator rejects vague criteria and more than eight tasks. Judgement, not machinery. |
| **DEC-2, CAP-1, CTX-3** review is its own session, can't edit, never reads the author's account | Separate workflow; `--tools "Read,Grep,Glob"`, no MCP servers, working tree checked unchanged afterwards; the prompt builder **has no parameter** for the PR body. |
| **GAT-9** deterministic checks first | One `ci` check running `npm run validate`: tests, two fixed-seed simulators with exact baselines, the artifact build. |
| **HUM-3** corrections capped | The reviewer counts its own prior `FIX` markers; a fourth becomes `DESIGN AMBIGUITY`. |
| **MRG-1, MRG-6** a human merges | Merge, approve and auto-merge tools removed in `.claude/settings.json`. See deviations: this is settings, not credentials. |

## Decisions, and why

Each of these was a choice between at least two reasonable options. The
reason is the part worth copying.

**D1. Live state in one pinned issue; knowledge in versioned docs.** The owner
asked for the handoff log to be an issue. Agreed for *state* (what's in
flight, what's blocked), because an issue gives checkboxes, links and phone
notifications. Disagreed for *knowledge* (rules, design, how the code fits),
because a session on an old commit must read docs that match that commit.
Sessions read the issue's **body**, which the owner curates; comments are
discussion, not instructions (SEC-5). Recorded as the project's ADR 0001.

**D2. Every stage starts with a label or a slash command.** Labels for the two
stages that run in Actions (plan, review), slash commands for the two that run
interactively (implement, fix). Either way it is a human act (HUM-1), and the
owner can do all of it from the GitHub mobile app. "I can still call Claude
from one app" was the requirement.

**D3. Only plan and review moved into Actions.** They are the stages where
read-only capability and an explicit fetch list matter most, and where a
session with write access would do the most damage by drifting. Implement and
fix stay interactive until the dispatch gets tedious; the build order says so.

**D4. Trigger, state and override labels are different kinds.** Trigger labels
(`run:review`, `run:plan`, `run:plan-approve`) are removed by the workflow
before it does anything, so re-adding one is a clean retry (DSP-2). State
labels (`review:*`, `plan:*`) describe what's true; setting one review label
clears the others (DSP-5). The first draft used a review label for a blocked
plan; it got its own `plan:needs-decision`.

**D5. The reviewer runs on `pull_request_target`, with the PR checked out
beside main, not over it.** The workflow, scripts, prompts and `AGENTS.md` all
come from the integration branch; the PR's files sit in `.review-pr/` and are
only read. A PR cannot edit its own reviewer (CTX-1). The PR head is fetched
with a one-off auth header and `persist-credentials: false`, so the session's
checkout holds no token (SEC-3).

**D6. Outcome comes from the CLI's envelope, never the model.** The composite
action writes evidence files (`ran`, `exit-code`, `envelope.json`,
`stderr.log`, `tree-modified`) and always exits 0; a separate script classifies
`completed / budget_exhausted / failed / not_run` from them (OUT-3). A missing
secret is `not_run` with a reason, not a failure.

**D7. A verdict is a fixed format, and a truncated one is not a verdict.** First
line `VERDICT: …`, four fixed headings, last line `<!-- review-complete -->`.
Anything else publishes "no valid verdict" and sets the `review` status to
`error`, not `failure` (OUT-5, GAT-4). The format is cheap to check and is the
only thing that makes OUT-5 enforceable.

**D8. Linking ≠ 1 issue is a deterministic `PLANNING FAILURE`.** Read from
GitHub's closing-issue references before any session starts. No model is
needed to say "this PR has no contract" (GAT-9).

**D9. Plans are JSON, validated whole, materialised on a second label.** The
planner emits a fenced JSON plan; the validator checks ids, areas, non-vague
criteria, dependencies that resolve, no cycles, at most eight tasks. The plan
is embedded in the comment as a base64 marker, and `run:plan-approve` creates
issues **from the marker the bot wrote**, never from text a person could have
edited (HND-4). Re-running approve is idempotent.

**D10. One model per role, as a repository variable. Record, don't route.**
The strongest model for planning and review, the default for building. No
fallback list (SES-5 deviation) and no per-task routing until the run log
shows a class of task that keeps failing. Each comment carries a hidden
`agent-session` record (model, outcome, cost, turns) so the log can be derived
later (OBS-10).

**D11. The CLI is pinned by lockfile with an integrity hash.** A tiny
`package.json` under `.github/agent-tools/` exists only to pin Claude Code, so
`npm ci` checks the hash (INT-8). Upgrades are their own PR, followed by the
self-test.

**D12. A self-test proves the capability removal.** `agent-selftest.yml`, run by
hand, asks a read-only session to create a file and asserts the file is
absent and the session completed. It is the CAP-3 check, and the first thing
to run after adding the secret or upgrading the CLI.

**D13. The pipeline's own logic is tested, and the tests are mutation-checked.**
28 unit tests over prompt building, verdict extraction, the cap, plan
validation and outcome classification, plus scenario runs against a fake
GitHub API. Every test was checked by breaking the code it covers once.
The first run passing everything was treated as suspicious, not as success.

**D14. `AGENTS.md` is canonical; `CLAUDE.md` is `@AGENTS.md`.** Single source for
instructions, role docs in `docs/agents/`, slash commands as one-line stubs.
Vendor-neutral by layout even though only one vendor is in use (HND-6).

**D15. Tickets only where seams are frozen.** Borrowed from lane-arena: a task
that has to design a contract stalls when read cold. Core-contract changes go
to one focused session; tickets are for additive work.

## Self-assessment

Against [04-conformance](../../docs/architecture/04-conformance.md). Honest,
including the failures.

| Level | Holds | Does not hold |
| --- | --- | --- |
| **0** | MRG-6 (merge tools removed), INT-1 (one `ci` check), SEC-3 (no credential in session) | **MRG-2**: no branch protection (private repo, GitHub Free). **MRG-3**: the session writes as the owner. **SEC-1** partly: one token for all scripts. |
| **1** | DEC-1/2, CAP-1, CTX-1 for the Actions stages; CAP-3 self-test; DSP-2; DSP-7; HND-4; HUM-1 | HND-3 is judgement only. CTX-1/CTX-3 are prose, not capability, for *interactive* `/review`. |
| **2** | OUT-3, OUT-5, OUT-6, HUM-2, HUM-3 | GAT-10, OBS-1/3 partly: state is labels and a curated issue, not derived. |
| **3** | HND-6 by layout | SES-1/2/6/7/8: one runtime, one model per role, no fallback. Deliberate. |
| **4** | OBS-7 (pipeline logic tested) | OBS-6: no ledger yet; the `agent-session` markers are its raw material. |

**Strictly, this is not level 0**, because MRG-2 is missing: nothing enforces
"no merge without green CI". With one owner who is also the only merger, the
risk this protects against is mostly the owner's own haste. That is a real
risk and it is recorded, not waved away.

## Deviations

As recorded in the project's `docs/AGENT_WORKFLOW.md`, where someone touching
that code will read them:

| Rule | Instead | Cost, and when to revisit |
| --- | --- | --- |
| **MRG-2** | No ruleset: private repo on GitHub Free | Nothing enforces green-before-merge. Revisit on Pro, or if the repo goes public. |
| **MRG-1** | Sessions open PRs as the owner; authors can't approve their own PRs, so required approvals stay 0. The merge is the human act. | No second identity. Revisit if a bot account opens PRs. |
| **MRG-3 / MRG-6** | Merge, approve and auto-merge tools denied in `.claude/settings.json` | Settings, not credentials: a session with the owner's token could still merge another way. |
| **CAP-1, CTX-3** (interactive) | Enforced only by the label-run review. Interactive `/review` is told not to read the PR body. | Use the label for any review you merge on. |
| **SES-5** | One model per role, no fallback | A busy model fails the run instead of quietly using a cheaper one. |
| **CTX-4** | `/implement` sessions can see other issues; they're told to read one | Scope creep is possible; review checks scope against the task. |

## Evidence so far

Thin, and labelled as such.

- **One task through review.** The CI task (`npm run validate`) went through an
  interactive `/review` and passed first time. It carried no session markers,
  because it predates the Actions reviewer. One data point says nothing about
  the first-pass rate.
- **No live Actions session yet.** The workflows are verified by unit tests,
  scenario runs against a fake API, and actionlint. The self-test is waiting
  on the secret. Treat the Actions side as untested against a real model.
- **One real bug found after merge** (below), by reading the pipeline, not by
  any check.

## Findings worth sending upstream

**1. A skipped job can impersonate the verdict.** The review job was named
`review`, and the verdict is the `review` commit status. On
`pull_request_target: labeled`, **every** label event creates a check run named
after the job, skipped unless the label is `run:review`. A skipped check
satisfies a required check of the same name. Had `review` been made required,
adding any other label would have satisfied it. INT-2 already says a skipped
job "counts as reported"; the new part is that a label-gated job sharing a
name with the verdict turns that into a false pass. The fix is a name that can
never be mistaken for the verdict (`agent-review-session`). Candidate rule:
*a gate's check name is used by exactly one producer*, verified by listing
check-run and status names on a PR after an unrelated label event.

**2. The template installs the agent CLI unpinned.**
`templates/github-actions/.github/actions/run-agent-session/action.yml` runs
`npm install -g @anthropic-ai/claude-code` with no version. That breaks INT-8
in the framework's own reference code, and means a CLI release can change a
role's capabilities between two runs of the same commit. A lockfile under the
action, installed with `npm ci`, is ten lines.

## What to take from it

- The firm rules are cheap **if** the review stage is built properly. Nearly
  all of the control plane is the reviewer and planner: capability removal,
  fetch lists, outcome classification and the truncation gate. Nothing else
  needed code.
- Merge protection is the rule a small private project is most likely to be
  unable to hold, and it is in level 0. The profile should say what to do
  then, not leave it as a silent gap.
