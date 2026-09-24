# GitHub Actions implementation

A working instance of the pipeline in
[`../../docs/PIPELINE.md`](../../docs/PIPELINE.md): the agent control plane,
CI with the agent-specific gates, the intake contract, and four toolchain
adapters that are the only place your language appears.

~22,000 lines, lifted from a production system and genericized. Drop
`.github/` into a repository, rewrite the four adapters, run the bootstrap.

Component letters (**C1**–**C7**) refer to
[`../../docs/architecture/01-components.md`](../../docs/architecture/01-components.md);
rule IDs to [`../../RULES.md`](../../RULES.md).

## What is here

### The toolchain adapters — rewrite these four, and only these four

| File | Answers |
| --- | --- |
| `.github/scripts/project-validate.sh` | Is this checkout green? |
| `.github/actions/setup-toolchain/action.yml` | Install what that needs |
| `.github/actions/format-code/action.yml` | Deterministic formatting + lint residue |
| `.github/scripts/suite-log.sh` | Run the suite against an arbitrary tree (the red gate) |

Everything else calls these, never your tools. That indirection is why a
control plane written for one language moves to another by editing strings.

### The agent control plane

| File | Role / component |
| --- | --- |
| `.github/workflows/agent-01-planner.yml` | Plan — read-only, strong tier |
| `.github/workflows/agent-02-implement.yml` | Implement — write, per-item tier |
| `.github/workflows/agent-04-review.yml` | Review — read-only, strong tier |
| `.github/workflows/agent-05-fix.yml` | Correct — write, escalating |
| `.github/workflows/agent-06-triage.yml` | Deferred findings → work items |
| `.github/workflows/agent-03-rollup.yml` | Parent completion |
| `.github/workflows/agent-00-dashboard.yml` | **C7** derived control plane |
| `.github/actions/run-agent-session/action.yml` | **C3** — the session runner |
| `.github/actions/build-*-request/action.yml` | **C2** — prompt assembly, and the fetch lists |
| `.github/actions/extract-review-verdict/action.yml` | **C5** — verdict + truncation gate |
| `.github/scripts/classify-*-outcome.py` | **C4** — one outcome vocabulary, two runtimes |
| `.github/agents/*.agent.md` | Role profiles |

### CI and the gates

| File | |
| --- | --- |
| `.github/workflows/ci.yml` | The aggregate check merge protection names |
| `.github/workflows/project-validation.yml` | One validation definition, three callers |
| `.github/scripts/count-tests.py` | The test ratchet's counter |
| `.github/scripts/red-gate.py` | The red gate's plan and verdict |

### The contract

| File | |
| --- | --- |
| `.github/ISSUE_TEMPLATE/*` | Intake types; the cold-start contract, enforced by required fields |
| `.github/pull_request_template.md` | Proposal contract |
| `.github/scripts/task_scope.py` | Delicate paths and undispatchable work, from declared scope |
| `.github/scripts/bootstrap-labels.sh` | The marker vocabulary. **Run this first** |

### Plumbing

`issue-linking.yml` · `issue-dependencies.yml` + `sync-issue-dependencies.py` ·
`run-ledger.yml` + `ledger_row.py` · `pipeline-report.yml` +
`pipeline_metrics.py` · `red-main.yml` · `render-dashboard.py` ·
`sync-human-credentials-label.py` · `issue-local-session.yml`

## Setup

**0. Set merge protection first, before any agent runs.**

Require the `ci` check and at least one human approval on the integration
branch; forbid direct pushes; ensure the identity your agents use cannot
approve or merge. This is conformance **level 0** — a pipeline without it is
an unreviewed-code-merging machine with an agent attached, and everything
else here makes it faster.
→ [MRG-1…MRG-6](../../RULES.md#mrg--merge-policy)

**1. Copy the files in.**

```bash
cp -r templates/github-actions/.github your-repo/
```

**2. Bootstrap the labels (DSP-8). Nothing works until you do.**

```bash
.github/scripts/bootstrap-labels.sh            # or: … owner/repo
```

Every trigger is keyed on a label **name**, and a fresh repository has none of
them. Until this runs, the control plane is inert **and silent** — no errors,
no logs, nothing to find. Edit the label list in the script first; it is your
vocabulary, not this repo's.

**3. Set the credential for whichever vendor you will use.**

| Label segment | Secret | Billed to |
| --- | --- | --- |
| `agent:*:copilot` | *(none — uses `GITHUB_TOKEN`)* | Copilot premium requests |
| `agent:*:anthropic` | `ANTHROPIC_API_KEY` | Anthropic Platform API credit |
| `agent:*:claude` | `CLAUDE_CODE_OAUTH_TOKEN` | A Claude Pro/Max subscription (mint with `claude setup-token`) |

A vendor whose secret is missing fails **before** the model loop and names the
secret it wanted.

**4. Set the model preference lists** as repository variables, so changing one
does not need a commit:

```
REVIEWER_MODELS     = claude-opus-5,claude-opus-4.8,claude-sonnet-5
PLANNER_MODELS      = claude-opus-5,claude-opus-4.8,claude-sonnet-5
IMPLEMENTER_MODELS  = (per tier — see docs/rationale/05-model-tiering.md)
FIXER_MODELS        = claude-sonnet-5,claude-opus-5
```

> **Model IDs are CLI-native and must not be copied between CLIs.** Copilot CLI
> spells Opus 4.8 `claude-opus-4.8`; Claude Code spells the same model
> `claude-opus-4-8`. The failure is quiet: an unreachable ID is skipped and the
> chain moves on, so a typo looks exactly like a chain that was never needed.
> `run-agent-session` dumps the CLI's own model list into the run log for
> exactly this reason — read it on the first run.

**5. Rewrite the four adapters.** Until you do, `project-validate.sh` exits
with "has not been adapted" and `setup-toolchain` fails loudly — deliberately,
rather than passing vacuously.

**6. Open a PR that closes a task Issue, add `agent:reviewer:claude`**, and
watch it review.

## The seam you must not widen (SES-1)

`run-agent-session` is the **only** file allowed to know about vendor
differences. Above it, everything takes `vendor` as an opaque input.

If you find yourself writing `if vendor == 'copilot'` in a workflow, the
abstraction has leaked — fix it in the action instead. That rule is what keeps
"switch who pays for this role" a one-label operation.

### The trap inside it

The two CLIs have **opposite** tool postures:

| CLI | Default | Knob |
| --- | --- | --- |
| Copilot | starts able | `--excluded-tools` takes away |
| Claude Code | starts unable under `--permission-mode dontAsk` | `--allowedTools` grants |

So `capability` is **one semantic knob** (`read-only` / `write`), encoded per
vendor inside the action, and callers never pass tool flags. A caller that
said "exclude nothing but sub-agents" meant *you may edit*; handed to the
additive vendor those same words mean *you may do nothing at all* — and the
session then runs, writes nothing, and looks exactly like a model that
underperformed.

`read-only` is the default because it is the fail-safe one.

## The four roles, at a glance

| | Planner | Implementer | Reviewer | Fixer |
| --- | --- | --- | --- | --- |
| Trigger | `agent:planner:*` on an Issue | `agent:implementer:*` on an Issue | `agent:reviewer:*`, or PR ready | `agent:fixer:*` on a PR |
| Capability | `read-only` | `write` | `read-only` | `write` |
| Tier | strong | per-item | strong | middle, escalating |
| Assembler fetches | epic + repo inventory | **one** task Issue | diff + criteria, **not the PR body** | the verdict + the diff |
| Publisher writes | sub-issues + plan comment, after **structural validation** | branch, draft PR, `validation:failed` | verdict comment + `review:*` | commits on the same branch |

## Substrate-specific traps

| | |
| --- | --- |
| **Prompt size** | Pass by file or stdin, never as an argv element. Linux caps one argument at 128 KiB (`MAX_ARG_STRLEN`), and a diff-bearing prompt passes that long before the larger `ARG_MAX` applies. |
| **Scratch location** | Build prompts in `$RUNNER_TEMP`, never the checkout. A prompt file in the working tree can end up committed. |
| **Label set replacement** | `gh pr edit --add-label` adds. `mcp__github__issue_write` **replaces**. Read current labels first on any surface that replaces. |
| **Replayed event payloads** | Re-running a job replays the original payload. A label added after a red gate is invisible unless the job reads labels live from the API. |
| **`workflow_dispatch` has no label** | Hence the explicit `vendor` input on every role workflow. |
| **CI cannot push to CI config** | `GITHUB_TOKEN` cannot modify `.github/workflows/`. Tasks touching it need a human-credentialed session — detect at plan time. |
| **Consuming the trigger** | Under `always()`, so a failed run is retryable by re-adding the label. |

## What is not here yet

The local agent-role counterparts (`.claude/agents/`, `.claude/commands/`) and
the control plane's own test suite. Both present in the source system and
mapped in [`../../EXTRACTION_INVENTORY.md`](../../EXTRACTION_INVENTORY.md).

Release and deployment are deliberately out of scope — see
[`../../docs/PIPELINE.md`](../../docs/PIPELINE.md).

## Conformance notes for this realization

Run the self-assessment in
[`../../docs/architecture/04-conformance.md`](../../docs/architecture/04-conformance.md).
Three checks deserve extra care here:

- **DSP-10 (gates read state live).** `pull_request` does not fire on
  `labeled`, and re-running replays the original payload. A gate trusting that
  payload cannot see an override added after it failed.
- **CAP-3 (capability per runtime).** The two CLIs here are opposites. Assert
  both postures, on both, before trusting either.
- **HUM-4 (undispatchable work).** `GITHUB_TOKEN` cannot modify
  `.github/workflows/`, so tasks touching CI configuration need a
  human-credentialed session — and that must be known at plan time, not at
  dispatch.
