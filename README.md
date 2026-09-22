# ai-devops-cicd

**How to build a CI/CD pipeline that develops software with agents** — the
architecture, the rules, a working GitHub Actions implementation, and a
methodology for adapting it to different tools.

Distilled from a production system, where it runs across ~38,000 lines of
control plane. Nothing here is speculative; every rule came out of something
that broke.

**Start with [`docs/PIPELINE.md`](docs/PIPELINE.md)** — the whole pipeline,
intake to merge, in one guide.

---

## In brief

Four agent roles, run as **four separate sessions**, handing each other
**durable artifacts** — wrapped in CI and merge policy that decide whether to
believe them:

```
intake ─plan─▶ task items ─implement─▶ change ─┬─CI────────┐
                                               └─review─▶ verdict ─fix─▶ ⟲
                                                           │
                                       green check + human approval ─▶ merge
```

| Stage | Capability | Tier | Reads | Writes |
| --- | --- | --- | --- | --- |
| Plan | **read-only** | strong | Intake item; system inventory | Task items; a plan record |
| Implement | write | per-item | **One** task item | Changes; a change proposal |
| Review | **read-only** | strong | The changes; the criteria | A verdict |
| Fix | write | middle ↑ | One verdict; the changes | Changes, same proposal |

A role is defined by exactly three things — its **capability posture**, its
**cost tier**, and **what it is allowed to see**. Not by its name. Two roles
with identical answers are one role with two names.

### The two ideas everything else follows from

**Constraints are enforced by absence, not instruction.** A planner told "do
not implement" implements anyway — a coding harness is built to produce a
change, and a prompt saying otherwise is arguing with the environment. Remove
the edit capability and the question does not arise. The same applies to
context: if a role must not be influenced by something, do not put it in the
prompt. An instruction to disregard present context competes with everything
else in the window.

**The handoff is readable cold.** No stage sees the previous stage's
reasoning, so the artifact is the entire contract. That is what makes every
stage retryable, auditable, substitutable by a different vendor or a person,
and interruptible by a human who wants to change their mind. It is also the
first property an optimisation will try to trade away.

### And the one that keeps it honest

**A machine verdict is never sufficient to merge.** Everything upstream is
agents judging agents — worth a great deal, and not independent oversight.
Merge policy is where that stops being sufficient, and it has to be enforced
by the platform rather than by a document asking people to be careful.
→ [MRG-1](RULES.md#mrg-1--a-machine-verdict-is-never-sufficient-to-merge--must)

---

## Start here

| If you want… | Read |
| --- | --- |
| **The whole pipeline, intake to merge** | [`docs/PIPELINE.md`](docs/PIPELINE.md) |
| **The rules** | [`RULES.md`](RULES.md) |
| **Working files to copy** | [`templates/github-actions/`](templates/github-actions/) |
| **To adapt it to different tools** | [`docs/adaptation/`](docs/adaptation/) — survey, seam catalogue, agent playbook, equivalence tests |
| To know whether what you built conforms | [`docs/architecture/04-conformance.md`](docs/architecture/04-conformance.md) |
| The abstract model beneath it | [`docs/architecture/00-the-model.md`](docs/architecture/00-the-model.md) |
| The smallest thing that is still this architecture | [tier 0](docs/architecture/02-substrate.md#tier-0--the-minimal-realization) — 40 lines of shell |
| Why a rule exists | [`docs/rationale/`](docs/rationale/) |

## Layout

```
docs/PIPELINE.md       The guide. Intake to merge, in one narrative.
RULES.md               98 normative rules. Numbered, checkable, cited by ID.
templates/             Working files. GitHub Actions, ~22k lines.
docs/architecture/     The abstract model: entities, components, substrate,
                       interfaces, conformance. No products named.
docs/adaptation/       Methodology for moving it to different tools: the
                       seams, the procedure, prompts for an agent companion,
                       and the tests that prove a port is right.
docs/rationale/        Field notes — why each rule exists, and what broke first.
examples/              The production system it was distilled from.
```

### The guide

| | |
| --- | --- |
| [00 The model](docs/architecture/00-the-model.md) | Entities, the pipeline, state transitions, what crosses each boundary |
| [01 Components](docs/architecture/01-components.md) | Seven components, and what each may **not** know |
| [02 Substrate](docs/architecture/02-substrate.md) | Eight capabilities, degradations, and a working tier-0 build |
| [03 Interfaces](docs/architecture/03-interfaces.md) | The data shapes crossing each boundary |
| [04 Conformance](docs/architecture/04-conformance.md) | Levels, a self-assessment, and the common failure shapes |

### The rules

Thirteen groups, 98 rules, each with **why**, **fails as**, and **verify**:

`DEC` decomposition · `CAP` capability · `CTX` context · `HND` handoff ·
`DSP` dispatch and state · `SES` session execution · `OUT` outcome and verdict ·
`GAT` quality gates · `OBS` observability · `HUM` human authority ·
`INT` continuous integration · `MRG` merge policy · `SEC` security and supply chain

Six are load-bearing — **DEC-1, DEC-2, CAP-1, CTX-1, HND-1, HND-3**. A system
holding those is recognisably this architecture even if it holds nothing else.

**`MRG-1` is separate.** It is not what makes the architecture work; it is
what makes it safe to run. A pipeline without it is an unreviewed-code-merging
machine with an agent attached, and everything else here makes it faster.

---

## Three findings worth the click

**Prose does not constrain an agent; missing tools do.** The fix for a planner
that keeps implementing is not a firmer instruction. It is no edit tool.
→ [CAP-1](RULES.md#cap-1--constraints-are-enforced-by-removing-capability--must)

**A reviewer must not receive the implementer's account of its own work.** Not
"should disregard" — must not receive. That text was written to be persuasive,
and a reviewer reading it checks the account rather than the work. The fix was
deleting one field from a fetch call, after prose failed to hold the line.
→ [CTX-3](RULES.md#ctx-3--a-reviewing-role-never-receives-the-reviewed-roles-account--must)

**A truncated review still says it passed on its first line.** So publication
gates on how the *session* ended, before believing anything the session said.
Without that, the review stage is theatre — silently.
→ [OUT-5](RULES.md#out-5--a-truncated-session-never-publishes-a-verdict--must)

## Two traps that fail silently

**Additive and subtractive agent runtimes are opposites.** One starts able and
a deny-list removes; the other starts unable and an allow-list grants. "Deny
nothing but delegation" means *you may write* to one and *you may do nothing
at all* to the other — and the session then runs, produces nothing, and looks
exactly like a model that underperformed. You will tune a prompt that was
never the problem. → [CAP-3](RULES.md#cap-3--translate-intent-per-runtime-in-one-place--must)

**A fresh substrate has no markers, so nothing fires and nothing says why.**
Triggers key on a name. Until the vocabulary exists, every stage is inert with
no error, no log, and nothing to find — and that silence reads as "not
triggered yet" for as long as it takes someone to guess.
→ [DSP-8](RULES.md#dsp-8--markers-are-created-before-the-pipeline-is-believed-to-work--must)

---

## Status

| | |
| --- | --- |
| ✅ | The integrated pipeline guide, intake to merge |
| ✅ | 98 rules across 13 groups, each with why / fails-as / verify |
| ✅ | The architecture: model, components, substrate, interfaces, conformance with 5 levels and a self-assessment |
| ✅ | GitHub Actions implementation — the full agent control plane, CI, gates, issue and PR templates, and four toolchain adapters |
| ✅ | Field notes behind every rule group |
| ✅ | Adaptation methodology — survey, 40-seam catalogue, build procedure, agent-companion playbook, 60 equivalence tests, deviation log |
| ⬜ | Further extraction from the source system — see [`EXTRACTION_INVENTORY.md`](EXTRACTION_INVENTORY.md) |

## Licence

MIT. See [`LICENSE`](LICENSE).
