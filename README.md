# ai-devops-cicd

**An architectural guide and rule set for building agentic software
development** — independent of programming language, agent runtime, tracker,
or CI system.

The architecture is the product. Everything else here — the rules, the field
notes, the worked realizations — exists to make it buildable on whatever you
have, including nothing but a shell and a directory of files.

Distilled from a production system, where it runs across ~38,000 lines of
control plane. Nothing here is speculative; every rule came out of something
that broke.

---

## The architecture, in brief

Four roles, run as **four separate sessions**, handing each other **durable
artifacts**:

```
intake ──plan──▶ task items ──implement──▶ change ──review──▶ verdict ──fix──▶ ⟲
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

---

## Start here

| If you want… | Read |
| --- | --- |
| **The architecture** | [`docs/architecture/00-the-model.md`](docs/architecture/00-the-model.md) |
| **The rules** | [`RULES.md`](RULES.md) |
| To know whether what you built conforms | [`docs/architecture/04-conformance.md`](docs/architecture/04-conformance.md) |
| To build it, phase by phase | [`docs/building/build-guide.md`](docs/building/build-guide.md) + [`worksheet.md`](docs/building/worksheet.md) |
| The smallest thing that is still this architecture | [tier 0](docs/architecture/02-substrate.md#tier-0--the-minimal-realization) — 40 lines of shell |
| Why a rule exists | [`docs/rationale/`](docs/rationale/) |
| What it looks like on a real stack | [`docs/realizations/`](docs/realizations/) |

## Layout

```
RULES.md               The normative rules. Numbered, checkable, cited by ID.
docs/architecture/     The guide: the model, components, substrate, interfaces,
                       conformance. No products named.
docs/rationale/        Field notes — why each rule exists, and what broke first.
docs/building/         Phase-by-phase build guide and a substrate worksheet.
docs/realizations/     The architecture on real stacks. Evidence, not product.
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

Ten groups, 76 rules, each with **why**, **fails as**, and **verify**:

`DEC` decomposition · `CAP` capability · `CTX` context · `HND` handoff ·
`DSP` dispatch and state · `SES` session execution · `OUT` outcome and verdict ·
`GAT` quality gates · `OBS` observability · `HUM` human authority

Six are load-bearing. A system holding **DEC-1, DEC-2, CAP-1, CTX-1, HND-1 and
HND-3** is recognisably this architecture even if it holds nothing else.

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
| ✅ | The architecture: model, components, substrate capabilities and degradations, interfaces, conformance |
| ✅ | 76 rules, each with why / fails-as / verify, and a self-assessment |
| ✅ | Field notes behind every rule group |
| ✅ | Build guide and substrate worksheet |
| ✅ | Realizations: tier 0 (shell + files), Jira + Jenkins, GitHub Actions (working files) |
| ⬜ | Realizations for GitLab and Azure DevOps beyond the capability table |
| ⬜ | Further extraction from the source system — see [`EXTRACTION_INVENTORY.md`](EXTRACTION_INVENTORY.md) |

## Licence

MIT. See [`LICENSE`](LICENSE).
