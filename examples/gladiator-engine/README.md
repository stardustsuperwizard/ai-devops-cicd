# Example: gladiator-engine

The control plane this repository was extracted from, running in production:
[stardustsuperwizard/gladiator-engine](https://github.com/stardustsuperwizard/gladiator-engine).

A turn-based hex-grid combat rules engine in Godot. The game is not the point
— it is the **worked instantiation** of everything in
[`../../docs/rationale/`](../../docs/rationale/), including the parts that are
specific to one engine and therefore cannot be templated.

## What to look at, and why

| Want to see | Look at |
| --- | --- |
| The full architecture writeup, with the reasoning intact | `docs/AGENT_WORKFLOW.md` (2,548 lines) |
| Why there are four roles and not five | `docs/AGENT_ROLE_DESIGN.md` |
| The vendor abstraction, in production | `.github/actions/run-agent-session/action.yml` |
| Context isolation enforced by a fetch list | `.github/actions/build-review-request/action.yml` — note what `gh pr view --json` does **not** request |
| A plan validated structurally before any Issue is created | `.github/workflows/agent-01-planner.yml` |
| Derived state, no board | `.github/scripts/render-dashboard.py` |
| The red gate and test ratchet | `.github/scripts/red-gate.py`, `count-tests.py`, `ci.yml` |
| **A control plane with its own test suite** | `.github/scripts/test-workflow-logic.sh` (7,940 lines) |

## The toolchain seam

Per the decision recorded in
[`../../EXTRACTION_INVENTORY.md`](../../EXTRACTION_INVENTORY.md), Godot stays
an **example** here rather than being generalized into a formal adapter
contract. But the seam the source repo drew is worth copying, because it is
the reason ~90% of the control plane ported cleanly.

Every engine-specific operation lives behind a named script or composite
action, and the agent workflows call **those**, never the tool:

| Operation | The seam |
| --- | --- |
| Install the toolchain | `.github/actions/setup-godot/action.yml` |
| Validate / typecheck | `.github/scripts/validate-godot.sh` |
| Lint + deterministic format | `.github/actions/lint-gdscript/action.yml` |
| Run tests | `.github/scripts/validate-godot.sh` (headless) |
| Count tests + assertions | `.github/scripts/count-tests.py` |
| Smoke test | `.github/scripts/smoke-godot.sh` |
| Package / export | `.github/scripts/export-godot.sh` |

To port to another stack, you replace the right-hand column. `agent-02-implement.yml`
— all 2,629 lines of it — changes by a handful of strings.

**That is the whole trick.** Draw this boundary on day one. Retrofitting it
into workflows that call `godot --headless` inline is a rewrite.

## What is genuinely Godot-specific

Roughly 2,240 lines across eleven files, listed as Tier 3 in the inventory.
Two of them are worth understanding even if you will never touch Godot:

**`red-gate.py` (641 lines)** — the "was this test red at the merge base?"
gate. Its *docstring* is the transferable part: it spends two pages arguing
why the unit of measurement is the **test suite** rather than the test
function, grounded in four specific facts about what the harness can emit. The
lesson generalizes exactly: pick the finest unit your harness produces a
machine-readable result for, and no finer. A verdict you cannot compute is a
verdict that will be faked.

**`count-tests.py` (468 lines)** — the ratchet's counter, and a case study in
not re-implementing. It is an explicit *port* of two in-engine test contracts,
and it says so next to every ported rule, naming the original as the
definition of record so the two cannot drift without the docstring lying about
it. Worth copying as a documentation habit regardless of language.

## Things this example does that the templates do not yet

Not ported into `templates/` in the first pass, but visible here working:

- **Three vendors on one workflow per role** — `copilot`, `anthropic`,
  `claude`, chosen by a label's third segment
- **Per-task model tiering** set by the planner as a `model:*` label
- **A run ledger** recording every session's role, tier, model, outcome,
  duration and cost
- **Local role parity** — `.claude/agents/` and `.claude/commands/` mirror the
  five roles for desktop and mobile sessions, with every GitHub call site
  written out twice (`gh` for terminal, `mcp__github__*` for cloud)
- **Issue templates** that encode the cold-start contract structurally
- **`issue-linking.yml`** — dispatch bookkeeping, including the
  no-originating-issue marker convention for PRs with no closing reference

## A caution about reading it

The source repo's docs cite Issue numbers from *its* source repository
(`mikeys_game_bones-rules-moba`), carried across deliberately because they
record reasoning that was expensive to reach. Treat them as citations to prior
art, not as work items — and not as anything you can look up.
