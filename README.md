# ai-devops-cicd

A platform-agnostic reference for running AI agents as a development pipeline:
the architecture, the findings that shaped it, drop-in templates, and a guide
for rebuilding it on a different stack.

Extracted from a working control plane — the
[gladiator-engine](https://github.com/stardustsuperwizard/gladiator-engine)
game project, where ~38,000 lines of it run in production on GitHub Actions.
Nothing here is speculative; every claim came out of something that broke.

## The shape of it

Four roles, run as **four separate sessions**, handing each other **durable
artifacts**:

```
Intake item ──plan──▶ Task items ──implement──▶ Change proposal ──review──▶ verdict ──fix──▶ ⟲
```

| Stage | Capability | Tier | Reads | Writes |
| --- | --- | --- | --- | --- |
| Plan | **read-only** | strong | Intake item, repo inventory | Task items, plan comment |
| Implement | write | per-task | **One** task item | Code, a change proposal |
| Review | **read-only** | strong | The diff + acceptance criteria | A verdict |
| Fix | write | middle ↑ | The verdict + the diff | Commits, same branch |

And the seven invariants everything else follows from:

1. Each role is a **separate session** — one session means one model, so
   per-role tiering requires separate sessions.
2. Constraints are **capabilities removed**, not instructions added.
3. The handoff is an artifact a **cold session** can read.
4. Control-plane state is **derived**, never stored twice.
5. Vendor differences live in **exactly one file**.
6. A **truncated session never publishes a verdict**.
7. Model spend on a new decision requires a **human tap**.

## Start here

| If you want to… | Read |
| --- | --- |
| Understand the design in ten minutes | [`docs/concepts/00-overview.md`](docs/concepts/00-overview.md) |
| Read the one finding that matters most | [`docs/concepts/02-capability-removal.md`](docs/concepts/02-capability-removal.md) |
| Build this on GitHub Actions | [`templates/github-actions/`](templates/github-actions/) |
| Build this on Jira + Jenkins (or GitLab, or Azure DevOps) | [`docs/porting/platform-mapping.md`](docs/porting/platform-mapping.md) |
| Hand the port to an agent session | [`docs/porting/build-guide-for-agents.md`](docs/porting/build-guide-for-agents.md) + [`worksheet.md`](docs/porting/worksheet.md) |
| See what is left to extract | [`EXTRACTION_INVENTORY.md`](EXTRACTION_INVENTORY.md) |

## Layout

```
docs/concepts/     Platform-agnostic reasoning. Tracker- and CI-neutral.
docs/porting/      Primitives, platform mappings, build guide, worksheet.
templates/         Drop-in files. Currently: GitHub Actions.
examples/          The gladiator-engine instantiation, incl. the Godot bits.
EXTRACTION_INVENTORY.md   What is ported, what is not, in what order.
```

### The concept docs

| | |
| --- | --- |
| [00 Overview](docs/concepts/00-overview.md) | The pipeline in one page |
| [01 Role design](docs/concepts/01-role-design.md) | When a role is real — and why an orchestrator is not |
| [02 Capability removal](docs/concepts/02-capability-removal.md) | **The central finding** |
| [03 Handoff contract](docs/concepts/03-handoff-contract.md) | The cold-start test |
| [04 Context isolation](docs/concepts/04-context-isolation.md) | What a role must *not* see |
| [05 Model tiering](docs/concepts/05-model-tiering.md) | Cost routing, per-task tiers, fallback chains |
| [06 State markers](docs/concepts/06-state-markers.md) | Triggers vs. state vs. buttons |
| [07 Derived state](docs/concepts/07-derived-state.md) | A control plane that cannot drift |
| [08 Session outcomes](docs/concepts/08-session-outcomes.md) | Outcome vocabulary + verdict protocol |
| [09 Quality gates](docs/concepts/09-quality-gates.md) | Stopping the cheapest way to green |

## Three findings worth the click

**Prose does not constrain an agent; missing tools do.** A planner told "do not
implement" implements anyway — a coding harness is built to produce a diff, and
an instruction is arguing with the environment. Remove the edit tool and the
question does not arise. → [02](docs/concepts/02-capability-removal.md)

**A reviewer must not read the implementer's description of its own work.** Not
"should disregard" — must not *receive*. The fix was deleting one field from a
`gh pr view --json` call, after prose failed to hold the line.
→ [04](docs/concepts/04-context-isolation.md)

**A truncated review still says `VERDICT: PASS` on its first line.** So the
verdict extractor gates on the session's *outcome* before honouring the
verdict. Otherwise the review stage is theatre.
→ [08](docs/concepts/08-session-outcomes.md)

## Status

First pass. Complete and usable:

- ✅ Nine concept docs
- ✅ Reference architecture, platform mapping (GitHub / Jira+Jenkins / GitLab /
  Azure DevOps), build guide, porting worksheet
- ✅ One worked vertical on GitHub Actions — vendor-blind session runner,
  outcome classifiers, verdict extraction with the truncation gate, label
  bootstrap, and the reviewer role end to end
- ✅ Full extraction inventory of the source control plane, with port order

Not yet ported: the planner, implementer, fixer and triage workflows; the
prompt-assembler actions; dependency wiring; the control-plane renderer; the
quality gates; the run ledger. All mapped in
[`EXTRACTION_INVENTORY.md`](EXTRACTION_INVENTORY.md) — steps 2 through 5 are
the critical path.

## Licence

MIT. See [`LICENSE`](LICENSE).
