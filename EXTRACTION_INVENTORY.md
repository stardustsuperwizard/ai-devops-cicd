# Extraction inventory

Every file in the source control plane (`stardustsuperwizard/gladiator-engine`),
classified by how much of it transfers, with a port order.

**Source survey date:** 2026-09-21. **Total surveyed:** ~38,400 lines across
84 files.

## The headline finding

**The control plane is already ~90% engine-agnostic.** Godot coupling is
concentrated in nine files; everything else mentions it in passing or not at
all. Measured by matches for `godot|gdscript|gdlint|gdformat|\.gd|hex|skirmish|gladiator`:

| Coupling | Files | Lines | Share |
| --- | --- | --- | --- |
| **None** (0 matches) | 19 | 6,394 | Lift as-is |
| **Incidental** (1–9 matches) | 40 | 17,600 | Comment/example edits only |
| **Moderate** (10–50) | 11 | 12,000 | Real but contained work |
| **Heavy** (50+) | 4 | 2,240 | Adapter boundary — example only |

That distribution is not luck. The source repo drew its toolchain boundary at
`validate-godot.sh` / `setup-godot` / `lint-gdscript` and made the agent
workflows call those rather than the tools. The port inherits that seam.

## Status legend

| | |
| --- | --- |
| ✅ | Ported into `templates/` in this pass |
| 📄 | Reasoning extracted into `docs/concepts/` or `docs/porting/` |
| ⬜ | Not yet ported |
| 🎮 | Godot-specific — belongs in `examples/`, not `templates/` |
| ❌ | Not worth porting |

---

## Tier 1 — lift as-is (zero or near-zero coupling)

These need no genericization beyond a comment or two.

| File | Lines | Component | Status |
| --- | --- | --- | --- |
| `.github/actions/run-agent-session/action.yml` | 873 | **C3** session runner | ✅ |
| `.github/actions/extract-review-verdict/action.yml` | 315 | **C5** verdict + truncation gate | ✅ |
| `.github/scripts/classify-copilot-outcome.py` | 379 | **C4** outcome classifier | ✅ |
| `.github/scripts/classify-claude-outcome.py` | 315 | **C4** outcome classifier | ✅ |
| `.github/scripts/model_response.py` | 86 | Shared outcome reader | ✅ |
| `.github/scripts/bootstrap-labels.sh` | 122 | Marker vocabulary | ✅ |
| `.github/scripts/sync-issue-dependencies.py` | 579 | Dependency wiring | ⬜ |
| `.github/scripts/sync-human-credentials-label.py` | 489 | 🔑 detection | ⬜ |
| `.github/scripts/render-pipeline-report.py` | 840 | Metrics reporting | ⬜ |
| `.github/scripts/pipeline_metrics.py` | 474 | Metrics | ⬜ |
| `.github/scripts/red-main.py` | 461 | Base-branch escalation | ⬜ |
| `.github/scripts/issue_dependencies.py` | 324 | Dependency parsing | ⬜ |
| `.github/scripts/ledger_row.py` | 285 | Run ledger | ⬜ |
| `.github/workflows/issue-linking.yml` | 683 | Dispatch bookkeeping | ⬜ |
| `.github/workflows/run-ledger.yml` | 590 | Cost/outcome ledger | ⬜ |
| `.github/workflows/red-main.yml` | 474 | Scheduled base-branch run | ⬜ |
| `.github/workflows/agent-00-dashboard.yml` | 245 | **C7** control plane | ⬜ |
| `.github/workflows/issue-dependencies.yml` | 215 | Dependency wiring | ⬜ |
| `.github/workflows/pipeline-report.yml` | 199 | Metrics | ⬜ |
| `.github/workflows/issue-local-session.yml` | 167 | Local-session bridge | ⬜ |

## Tier 2 — light genericization (1–9 matches, mostly comments)

| File | Lines | What to change | Status |
| --- | --- | --- | --- |
| `.github/workflows/agent-02-implement.yml` | 2,629 | Swap `validate-godot.sh` calls for the adapter contract | ⬜ |
| `.github/workflows/agent-01-planner.yml` | 2,255 | Rubric examples reference game concepts | ⬜ |
| `.github/workflows/agent-05-fix.yml` | 1,069 | Two validation-command references | ⬜ |
| `.github/workflows/agent-06-triage.yml` | 863 | Three example strings | ⬜ |
| `.github/scripts/build-plan-review-request.py` | 803 | Example plan fixtures | ⬜ |
| `.github/workflows/agent-04-review.yml` | 630 | Template written ✅; full port still ⬜ | ✅ (template) |
| `.github/scripts/red-gate.py` | 641 | Suite-discovery hook → adapter | ⬜ |
| `.github/scripts/count-tests.py` | 468 | Assertion pattern → adapter | ⬜ |
| `.github/scripts/render-dashboard.py` | 506 | **C7**; ⚠️/🔑 file patterns → config | ⬜ |
| `.github/agents/01-planner.agent.md` | 442 | Domain examples | ⬜ |
| `.github/agents/07-plan-reviewer.agent.md` | 367 | Domain examples | ⬜ |
| `.github/workflows/release.yml` | 367 | Export step → adapter | ⬜ |
| `.github/scripts/task_scope.py` | 291 | ⚠️ extension list → config | ⬜ |
| `.github/actions/build-review-request/action.yml` | 352 | **C2** — the `body`-omission is the point | ⬜ |
| `.github/actions/build-fix-request/action.yml` | 280 | **C2** | ⬜ |
| `.github/actions/build-plan-review-request/action.yml` | 247 | **C2** | ⬜ |
| `.github/scripts/release-preflight.py` | 252 | Version-file path → config | ⬜ |
| `.github/agents/02-implementer.agent.md` | 231 | Validation command | ⬜ |
| `.github/workflows/agent-03-rollup.yml` | 200 | One string | ⬜ |
| `.github/agents/05-fixer.agent.md` | 114 | Two strings | ⬜ |
| `.github/agents/03-reviewer.agent.md` | 74 | Two strings | ⬜ |
| `.claude/agents/*.md`, `.claude/commands/*.md` | 2,558 | Local role counterparts; dual `gh` / MCP call sites | ⬜ |
| `.github/ISSUE_TEMPLATE/*` | 599 | Intake templates — the cold-start contract | ⬜ |
| `.github/pull_request_template.md` | 71 | Incl. the no-originating-issue marker trick | ⬜ |
| `.github/copilot-instructions.md` | 294 | Repo-conventions pattern | ⬜ |
| `.github/skills/code-review/SKILL.md` | 94 | | ⬜ |
| `.claude/hooks/*.sh` | 164 | Session-start + boundary guard | ⬜ |

## Tier 3 — toolchain adapter boundary (🎮 example only)

Per your decision: **kept as an example, no formal adapter contract.** These
stay in `examples/gladiator-engine/` and are what a consumer reads to see how
the seam was drawn.

| File | Lines | Matches |
| --- | --- | --- |
| `.github/scripts/test-workflow-logic.sh` | 7,940 | 213 |
| `.github/workflows/ci.yml` | 1,228 | 87 |
| `.github/workflows/gdscript-lint.yml` | 709 | 78 |
| `.github/scripts/test-spec-traceability.sh` | 497 | 18 |
| `.github/workflows/godot-validation.yml` | 222 | 21 |
| `.github/scripts/red-gate-base.sh` | 204 | 27 |
| `.github/actions/lint-gdscript/action.yml` | 179 | 30 |
| `.github/actions/setup-godot/action.yml` | 158 | 35 |
| `.github/scripts/export-godot.sh` | 129 | 35 |
| `.github/scripts/smoke-godot.sh` | 176 | 4 |
| `.github/scripts/validate-godot.sh` | 77 | 27 |

Note `test-workflow-logic.sh` (7,940 lines) — the largest file in the survey,
and a genuinely valuable artifact: **the control plane has its own test
suite.** Its harness is generic; its assertions are project-specific. Porting
the harness alone is a Tier-2 job hiding inside a Tier-3 file, and worth
doing on its own.

## Tier 4 — prose (📄 reasoning extracted)

| File | Lines | Extracted into | Status |
| --- | --- | --- | --- |
| `docs/AGENT_WORKFLOW.md` | 2,548 | `concepts/00`, `02`, `05`, `06`, `07`, `08`; `porting/reference-architecture` | 📄 partial |
| `AGENTS.md` | 597 | `concepts/03`; repo-conventions pattern still ⬜ | 📄 partial |
| `docs/AGENT_ROLE_DESIGN.md` | 239 | `concepts/01-role-design.md` | 📄 done |
| `docs/RUN_LEDGER.md` | 82 | Measurement section of `concepts/05` | 📄 partial |
| `docs/RELEASING.md` | 96 | Not yet | ⬜ |

`AGENT_WORKFLOW.md` is the source's crown jewel and is only partly mined. Four
sections not yet carried across, all worth it:

- *Four entry points, two different products* — scripted CLI vs. native cloud
  agent, and why a label cannot carry a model
- *Issue hierarchy* and *Issue views* — the saved-query vocabulary
- *The dependency chain* — how `blocker` and `blocked-by` interact
- *Resolved: paying for Claude sessions with a subscription instead of API
  credits* — the vendor-split rationale in full

## ❌ Not worth porting

| File | Why |
| --- | --- |
| `.github/scripts/spec_traceability.py` (249) | Couples to this project's spec document structure |
| `.github/scripts/spec-impact-report.py` (366) | Same |
| `.github/scripts/test-spec-traceability.sh` (497) | Tests the above |
| `docs/engine-reference/godot/*` | Pure Godot reference |

The *idea* behind spec traceability — machine-checkable links from spec
sections to implementing code — is worth a concepts page even though the code
is not portable. Filed under *Next up*, below.

---

## Port order

Each step is independently useful and independently verifiable. This is also
the order [`docs/porting/build-guide-for-agents.md`](docs/porting/build-guide-for-agents.md)
recommends building from scratch, which is not a coincidence.

| # | Work | Files | Unlocks |
| --- | --- | --- | --- |
| **1** ✅ | Session runner + classifiers + verdict + labels + one role | 6 | Any role can be built |
| **2** | The three prompt-assembler composite actions (**C2**) | 3 | Reviewer/fixer/plan-reviewer prompts |
| **3** | The planner workflow + plan validation | 2 | Epic → tasks |
| **4** | The implementer workflow + `validation:failed` | 1 | Task → PR |
| **5** | The fixer + escalation cap | 1 | The correction loop |
| **6** | Issue templates + PR template | 7 | The cold-start contract |
| **7** | Dependency wiring (`sync-issue-dependencies.py` + workflow) | 3 | Ordered dispatch |
| **8** | Control-plane renderer (**C7**) | 2 | The board |
| **9** | Quality gates: ratchet, red gate, base-branch run | 6 | The gates |
| **10** | Run ledger + pipeline metrics | 5 | Cost measurement |
| **11** | Local role counterparts (`.claude/`) | 12 | Desktop/mobile parity |
| **12** | Triage + rollup | 2 | Backlog hygiene |
| **13** | The control-plane test harness | 1 | Confidence in all of it |

Steps 2–5 are the critical path. Everything from 7 down is independently
valuable and can be reordered freely.

## Next up (documentation gaps, not ports)

- `concepts/10-local-parity.md` — running the same roles from a desktop or
  mobile agent session, and the `gh` vs. MCP dual-call-site pattern
- `concepts/11-measurement.md` — the run ledger: what to record per session and
  what it tells you
- `concepts/12-spec-traceability.md` — machine-checkable spec↔code links
- `templates/jenkins/` — the shared-library form of C3, sketched in
  [`docs/porting/platform-mapping.md`](docs/porting/platform-mapping.md)

## Re-running this survey

```bash
cd <source-repo>
for f in .github/workflows/*.yml .github/actions/*/action.yml .github/scripts/* \
         .github/agents/*.md .claude/agents/*.md .claude/commands/*.md; do
  n=$(grep -ci 'godot\|gdscript\|gdlint\|gdformat\|\.gd\b\|hex\|skirmish\|gladiator' "$f")
  echo "$n $(wc -l < "$f") $f"
done | sort -n
```

Swap the pattern for your own domain vocabulary to survey a different source.
The ratio it prints — domain matches per line — is a decent first estimate of
how much of a file transfers.
