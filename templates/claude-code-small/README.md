# Template: Claude Code, small-project profile

A drop-in control plane for one repository: a **planner** and a **reviewer** that run as read-only Claude Code sessions in GitHub Actions, started by labels, plus role docs for implementing and fixing, whether by Claude Code or by GitHub Copilot.

It is the [small-project profile](../../docs/proposals/0002-goals-first-vendor-neutral.md) built for real. It was extracted from [examples/jrpg-battle](../../examples/jrpg-battle/README.md), where it has planned and created a seven-task feature end to end. About 2,300 lines including tests and docs, against about 22,000 for [`templates/github-actions/`](../github-actions/). Read [The five firm rules](docs/AGENT_WORKFLOW.md#the-five-firm-rules) first; the rest of the framework is adopted only when something breaks.

The scripts are Node with no dependencies, so the repository itself can be in any language.

## What's in it

| Path | What | Change it? |
|---|---|---|
| `.github/workflows/agent-review.yml` | `run:review` on a PR → read-only review → verdict comment, one `review:*` label, the `review` commit status | No |
| `.github/workflows/agent-plan.yml` | `run:plan` on an issue → validated plan for approval; `run:plan-approve` → task issues | No |
| `.github/workflows/agent-selftest.yml` | Run by hand: proves the credential works and a read-only session can't write | No |
| `.github/workflows/bootstrap-labels.yml` | Run by hand: creates every label in `labels.json` | No |
| `.github/workflows/copilot-setup-steps.yml` | Copilot's environment | **Yes**: mirror your CI setup |
| `.github/actions/run-claude/` | The one place that runs the CLI: fixed tools, budget, evidence files | No |
| `.github/agent-tools/` | Pins Claude Code by version and integrity hash [INT-8] | Only to upgrade |
| `.github/agents.json` | Areas, and the human-check label name | **Yes** |
| `.github/labels.json` | Labels; area labels must match `agents.json` | **Yes**: areas |
| `.github/ISSUE_TEMPLATE/`, `pull_request_template.md` | Agent task and idea forms; PR shape | If you like |
| `.github/copilot-instructions.md`, `CLAUDE.md` | One-line pointers to `AGENTS.md` | No |
| `.claude/settings.json`, `.claude/commands/` | Denies merge/approve/auto-merge; `/plan`, `/implement`, `/review`, `/fix` | No |
| `scripts/agents/` | Prompt building, outcome classification, verdict and plan validation, GitHub calls | No |
| `scripts/agents/test/` | 30 tests of the above: `cd scripts/agents && npm test` | No |
| `docs/agents/*.md` | The four roles | Lightly |
| `docs/AGENT_WORKFLOW.md` | The process, labels and deviations | **Yes**: deviations |
| `AGENTS.md` | Canonical instructions | **Yes**: fill every `ADAPT` |

## Adopting it

1. **Copy** this directory's contents into the repository root. Nothing here collides with application code except `AGENTS.md` and `CLAUDE.md`; merge those by hand if they exist.
2. **Fill in `AGENTS.md`:** the validate command, the design docs, and the project's rules. Write each rule as something a diff can break: the reviewer checks them under *Safety*.
3. **Set the areas** in `.github/agents.json`, and the same names in `.github/labels.json`.
4. **CI first.** The reviewer reads CI results; it does not run the tests itself. You need one CI job that runs the validate command on every PR, with no path filters [INT-1, INT-2].
5. **Add one repository secret:** `CLAUDE_CODE_OAUTH_TOKEN` (a Claude subscription; create it with `claude setup-token`) or `ANTHROPIC_API_KEY` (billed to the API).
6. **Run Actions → Bootstrap labels**, then **Actions → Agent self-test**. Both must go green before the first real run.
7. **Merge protection**, if the plan allows it: require your CI check and the **`review` commit status**. Never require a check named after a workflow job: a label-gated job reports *skipped* on every other label event, and skipped satisfies a required check of the same name (see the example's finding 1).
8. **Optional variables:** `AGENT_REVIEW_MODEL`, `AGENT_PLAN_MODEL`, `AGENT_*_EFFORT` (default `high`), `AGENT_REVIEW_BUDGET_USD` (5), `AGENT_PLAN_BUDGET_USD` (10).
9. **Copilot**, if you have it: adapt `copilot-setup-steps.yml`, and check that Copilot's coding agent is enabled for the repository.

Then try it on something small: put `run:plan` on an idea issue, read the plan, and add `run:plan-approve`.

### In an organisation

- **Actions permissions:** the workflows declare `permissions:` per job and use only `actions/checkout`, `actions/setup-node` and (for bootstrap) `actions/github-script`. If your organisation allow-lists actions, those three are what's needed.
- **GitHub Enterprise Server:** the scripts use `GITHUB_API_URL` and `GITHUB_GRAPHQL_URL`, and the PR fetch uses `github.server_url`, all set by Actions on either host. Sub-issues and some label behaviour depend on the server version; nothing fails hard without them.
- **Forks are not reviewed.** `agent-review.yml` runs on `pull_request_target` with code from the default branch, and skips PRs from forks, which never receive the secret.
- **Who can trigger:** a label starts a session only when the person who added it has write access or above, because a session spends the budget [HUM-1].
- **Sub-issues:** task issues are linked to their source issue as sub-issues where the API allows. Where it doesn't, they are still created; the link is only a warning in the log.
- **Labels from a phone:** on the first adopter the owner couldn't add a label from the GitHub mobile app and asked an agent to add it. The cause wasn't found. If that blocks you, the web UI works on mobile.

## How it holds the firm rules

| Rule | Held by |
|---|---|
| Read-only planning and review [CAP-1] | `--tools "Read,Grep,Glob"`, no MCP servers, and the working tree checked unchanged afterwards. The self-test proves it [CAP-3]. |
| The reviewer never reads the author's account [CTX-3] | `buildReviewPrompt()` has no parameter for the PR body, commits or author comments. A test asserts a PR body never appears in the prompt. |
| A PR can't edit its reviewer [CTX-1] | `pull_request_target`: workflow, scripts and role docs come from the default branch; the PR is a read-only worktree at `.review-pr/`. |
| No credential in the session [SEC-3] | The session gets only the Claude secret; scripts post before and after it, never during. |
| Outcome from evidence, not prose [OUT-3] | `outcome.js` classifies the CLI's exit code and JSON envelope. |
| A truncated verdict is not a verdict [OUT-5] | First line `VERDICT:`, four fixed sections, end marker; otherwise the status is `error`, not `failure` [GAT-4]. |
| No contract, no review [GAT-9] | A PR that doesn't close exactly one issue gets `PLANNING FAILURE` without a session. |
| Corrections capped [HUM-3] | The fourth `FIX` becomes `DESIGN AMBIGUITY`, counted from the workflow's own markers. |
| Plans validated whole [HND-4] | Filled fields, checkable criteria, dependencies that resolve, no cycles, at most eight tasks. Approval creates issues from the bot's marker, never from editable text. |
| Cost recorded [OBS-10] | Every comment carries a hidden `agent-session` record. |

**Not included,** and why: the test ratchet and red gate [GAT-1, GAT-2], a run ledger [OBS-6], model fallback [SES-5], and implement/fix in Actions. Each is worth adding when its absence costs something; the [conformance levels](../../docs/architecture/04-conformance.md) say which matter first.

## What one run costs

From the first adopter's first live planner run, at `high` effort: a seven-task plan in 9 minutes, 33 turns and **$3.87** under a $10 budget. Approval, which runs no model, took 28 seconds. One data point; the `agent-session` markers are there so you can collect your own.

## Upgrading

Everything marked "No" above is the same in every adopting repository. Upgrade by copying those files over; your changes live in `AGENTS.md`, `agents.json`, `labels.json`, `copilot-setup-steps.yml` and the deviations table. To upgrade Claude Code, change the version in `.github/agent-tools/package.json`, regenerate the lockfile with `npm install --package-lock-only`, merge that alone, then rerun the self-test.
