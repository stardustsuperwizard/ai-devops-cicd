# Realization: GitHub + Actions

One substrate, with working files. **This is evidence that the component
contracts close, not the product** — the architecture is in
[`../../architecture/`](../../architecture/) and the rules in
[`../../../RULES.md`](../../../RULES.md). If you are on a different stack,
read [`../../architecture/02-substrate.md`](../../architecture/02-substrate.md)
instead; nothing here is required.

These files are lifted from a production control plane, so they are worth
reading even on another substrate: they show what the contracts look like when
something actually has to run. Drop `.github/` into a repository, edit the
seams, run the bootstrap script.

Every file here is **vendor-blind above the session runner**: it runs GitHub
Copilot CLI or Claude Code, chosen by a label segment, with no workflow
knowing which.

## What is here

| File | Component | Edit? |
| --- | --- | --- |
| `.github/actions/run-agent-session/action.yml` | **C3** — the session runner | Only to add a vendor |
| `.github/actions/extract-review-verdict/action.yml` | **C5** — verdict extraction + truncation gate | Only to change the verdict vocabulary |
| `.github/scripts/classify-claude-outcome.py` | **C4** — Claude Code outcome classifier | Rarely |
| `.github/scripts/classify-copilot-outcome.py` | **C4** — Copilot CLI outcome classifier | Rarely |
| `.github/scripts/model_response.py` | Shared outcome-reading helper | No |
| `.github/scripts/bootstrap-labels.sh` | The marker vocabulary | **Yes** — it is your vocabulary |
| `.github/workflows/agent-review.yml` | **C1 + C2**, worked end to end | **Yes** — this is the template to copy per role |

Component letters refer to
[`../../architecture/01-components.md`](../../architecture/01-components.md).

These files came from a working control plane; they are not sketches. The one
project-specific reference in them (a comment naming a validation script) was
genericized on the way across.

## Setup

**1. Copy the files in.**

```bash
cp -r templates/github-actions/.github/actions/run-agent-session   your-repo/.github/actions/
cp -r templates/github-actions/.github/actions/extract-review-verdict your-repo/.github/actions/
cp    templates/github-actions/.github/scripts/*.py                 your-repo/.github/scripts/
cp    templates/github-actions/.github/scripts/bootstrap-labels.sh  your-repo/.github/scripts/
cp    templates/github-actions/.github/workflows/agent-review.yml   your-repo/.github/workflows/
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

**5. Open a PR that closes a task Issue, add `agent:reviewer:claude`**, and
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

## Adding the other roles

`agent-review.yml` is the shape. Copy it per role and change four things:

| | Planner | Implementer | Fixer |
| --- | --- | --- | --- |
| Trigger | `agent:planner:*` on an Issue | `agent:implementer:*` on an Issue | `agent:fixer:*` on a PR |
| `capability` | `read-only` | `write` | `write` |
| Prompt assembler fetches | epic + repo inventory | **one** task Issue | the verdict + the diff |
| Publisher writes | sub-issues + plan comment, after **structural validation** | branch, draft PR, `validation:failed` | commits on the same branch |

Build them in the order in
[`../../building/build-guide.md`](../../building/build-guide.md).
Reviewer first is deliberate: it is read-only, so it cannot damage anything.

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

Roles beyond review, the prompt-assembler actions, dependency wiring, the
renderer, the gates, and the ledger. All present in the source system and
mapped in
[`../../../EXTRACTION_INVENTORY.md`](../../../EXTRACTION_INVENTORY.md).

Review is built first on purpose: it is read-only, so it cannot damage
anything, and it exercises C2 through C5 completely. Build the rest in the
order the [build guide](../../building/build-guide.md) gives.

## Conformance notes for this realization

Run the self-assessment in
[`../../architecture/04-conformance.md`](../../architecture/04-conformance.md).
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
