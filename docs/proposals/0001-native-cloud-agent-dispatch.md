# Proposal 0001 — Hand implementation to the platform's own cloud agent

| | |
| --- | --- |
| **Status** | Brainstorm. Nothing decided, nothing built. |
| **Origin** | A planning conversation between the repository owner and Claude Code, 2026-10-17/18, held against `stardustsuperwizard/gladiator-engine` |
| **Applies to** | The GitHub Actions realization (`templates/github-actions/`) and its production instance, gladiator-engine. If adopted, parts would change the rules themselves — see [Rule impact](#rule-impact). |
| **Names products** | Yes, deliberately. This is a realization proposal. CONTRIBUTING rule 1 binds `docs/architecture/` and `RULES.md`, not this file. |

## How to use this document

You are probably an agent asked to read, challenge, or improve this. Three
requests:

1. **Separate what was verified from what was inferred.** Every claim about
   GitHub's behaviour is tagged ✅ *verified* (read in GitHub's documentation
   source on 2026-10-17), ⚠️ *inferred*, or ❓ *unknown — needs an experiment*.
   Keep the tags honest if you edit. Most of the design rests on three ❓s.
2. **Argue with the rule impact table.** It is the part most likely to be
   wrong, and the part that matters most to this repository.
3. **Append, don't overwrite.** Add your comments to the
   [Review log](#review-log) at the end with a date and who you are. If you
   change the body, say so there.

---

## 1. The question

The owner's question, in order of how the conversation evolved:

1. *Would GitHub Copilot cloud agent, assigned to Issues, be a better fit than
   the bespoke four-role pipeline? Copilot can read all the agent files.*
2. *What about one top-level orchestrator agent with the other agents as
   sub-agents?*
3. *Am I really smarter than a team of engineers at GitHub at figuring this
   out? Why not assign Copilot to the ticket and use the service as intended?*
4. *Do I even need the planner?*

The short version of where it landed: **use the platform's agent for
implementation and correction; keep the pipeline's own roles where they encode
something the platform doesn't — deciding scope on the way in, and independent
judgement on the way out.**

## 2. What the current system assumes, and why

The pipeline described in this repository was built on GitHub Actions with
Copilot CLI sessions, not the Copilot cloud agent. gladiator-engine's
`docs/AGENT_WORKFLOW.md` and `docs/AGENT_ROLE_DESIGN.md` (verified against
GitHub's docs on 2026-08-21/22) recorded why:

- **No model selection through the assignment API.** `AgentAssignmentInput`
  had four fields — target repo, base ref, custom instructions, custom agent —
  and no model. Anything dispatched unattended ran on **Auto**, a draw from a
  pool that was about three-quarters non-Anthropic. An earlier
  `agent:implementer:copilot` label that assigned the cloud agent blind was
  removed for this reason, and replaced by a scripted CLI implementer walking a
  per-tier preference list (SES-5, SES-8).
- **`model:` and `tools:` in agent profiles were ignored on github.com**, so a
  custom agent could not carry a cost tier or a capability posture there.
- **The cloud harness pushes toward producing a diff.** A planner run as a
  cloud agent implemented despite being told not to. That incident is the
  origin of CAP-1. Planner and reviewer therefore run as CLI sessions with
  edit/shell tools removed.
- **Sub-agents were removed in every posture** (`task,write_agent` excluded in
  `run-agent-session/action.yml`) — CAP-5, DEC-2, DEC-5.

Those were correct when written. Several are no longer true.

## 3. What GitHub's documentation says now

Read from the source of GitHub's docs (`github/docs`, `main`, 2026-10-17)
because `docs.github.com` was unreachable from the session.

### Changed since August

| | Finding | Source |
| --- | --- | --- |
| ✅ | **The assignment API now takes `model`.** REST `agent_assignment.model`; GraphQL `agentAssignment.model`, which needs the header `GraphQL-Features: issues_copilot_assignment_api_support,coding_agent_model_selection`. `customAgent` and `model` can be set in the same call. | `content/copilot/how-tos/use-copilot-agents/cloud-agent/use-cloud-agent-via-the-api.md` |
| ✅ | **A separate agent tasks API**: `POST /agents/repos/{owner}/{repo}/tasks` with `prompt`, `base_ref`, `model`, `create_pull_request`. Without `model` you get Auto. Task states: `queued, in_progress, completed, failed, idle, waiting_for_user, timed_out, cancelled`. | same |
| ✅ | **Custom agent `tools:` is documented as filtering the cloud agent's tools** — aliases `read`, `edit`, `execute`, `search` map to cloud-agent tools; `tools: []` disables all. | `content/copilot/reference/custom-agents-configuration.md` |
| ✅ | **Custom agent `model:` is no longer marked IDE-only.** The reference table says properties apply to GitHub.com, the CLI and IDEs "unless otherwise noted", and `model` carries no note. | same |
| ✅ | **`@copilot` works on any PR**, with a model picker in the web UI (defaults to the PR's original model). "Fix with Copilot" can batch review comments, also with a model picker. Copilot "remembers context from previous sessions on the same pull request", and a PR started by a custom agent keeps that agent. | `content/copilot/how-tos/use-copilot-agents/cloud-agent/use-cloud-agent-on-github.md` |
| ✅ | **Copilot Automations** run the cloud agent on a schedule, on issue opened, PR opened, or PR synchronized, with chosen model and tools. **Private and internal repositories only.** gladiator-engine is public, so they're unavailable there. | `content/copilot/concepts/agent-capabilities/agent-powered-workflows-and-operations/about-automations.md` |

### Unchanged

| | Finding | Source |
| --- | --- | --- |
| ✅ | **Sub-agents are not supported on GitHub.com.** The customization matrix marks Subagents ✗ for GitHub.com, ✓ for VS Code and Copilot CLI. Custom agents ✓ everywhere. | `content/copilot/reference/customization-cheat-sheet.md` |
| ✅ | **`handoffs` and `argument-hint` are ignored** by the cloud agent on GitHub.com. | `custom-agents-configuration.md` |
| ✅ | **Assignment snapshots the Issue.** Copilot receives title, body, and existing comments; it "will not be aware of, and therefore won't react to, any further comments". New information goes on the PR. | `use-cloud-agent-on-github.md` |
| ✅ | **The assignment APIs take user tokens only** (PAT, OAuth, GitHub App user-to-server). `GITHUB_TOKEN` and App installation tokens are rejected. | `use-cloud-agent-via-the-api.md` |
| ✅ | **Issue assignment and both APIs are public preview.** | same |
| ✅ | **Actions don't run on cloud-agent PRs** until a user with write access approves them, by default. (A repository setting.) | `about-automations.md`, `use-cloud-agent-on-github.md` |
| ✅ | Auto "will select the best model based on availability and to help reduce rate limiting". The cloud-agent model list has 20 entries, 5 of them Claude. | `data/reusables/copilot/auto-model-option.md`, `copilot-cloud-agent-non-auto-models.md` |
| ✅ | Custom agent prompts are capped at **30,000 characters**. | `custom-agents-configuration.md` |

### A correction made during the conversation

The configuration reference lists an `agent` tool alias ("allows a different
custom agent to be invoked") with a cloud-agent mapping, and a
`disable-model-invocation` property described in cloud-agent terms. That was
first read as cloud sub-agent support. **The customization matrix contradicts
it, and the matrix is the explicit statement.** The most likely reading is that
the alias table is shared across surfaces, and that "invocation" means the
cloud agent choosing *which* custom agent runs a session. ❓ Not tested.

### Community reports, not GitHub's word

- ⚠️ A March 2026 community discussion
  ([#190228](https://github.com/orgs/community/discussions/190228)) reports
  assignment with `model` failing under a fine-grained PAT and working with
  OAuth.
- ⚠️ gh-aw's reference states the same user-token restriction.

## 4. How the conversation moved

Recorded because the rejected options matter as much as the chosen one.

**An orchestrator with the other agents as sub-agents — rejected for the cloud
pipeline.** GitHub.com has no sub-agents; one session has one model and one
tool policy; and it would collapse the reviewer's isolation into one context.
DEC-2, DEC-5 and CAP-5 already say this, and the platform now enforces it
independently. A local orchestrator (Claude Code sub-agents, which do take
per-agent `model:` and tool lists) remains possible and was noted as an
interactive-session pattern, which is what DEC-5 permits.

**Merging all the agent files into one custom agent — rejected.**
- It doesn't fit: planner + implementer + reviewer + fixer + plan-reviewer
  profiles total about 50,000 characters against a 30,000 limit.
- It mixes postures that must differ. Planner and reviewer must not write;
  inside one agent that is prose, which CAP-1 says is not a control.
- The platform already has better containers: repository instructions load
  into every session, and **skills** (supported on GitHub.com; read from
  `.github/skills/`, `.claude/skills/` or `.agents/skills/`) load on demand. One
  slim implementer custom agent plus skills for the specialised knowledge.

**"Am I smarter than GitHub's engineers?" — reframed.** The platform is built
for the typical repository. The useful split is between machinery that exists
to **work around the platform** (drop it when the limitation lifts) and
machinery that encodes **this project's needs** (keep it). Much of the scripted
implementer is the first kind, and its reason — no model selection when
unattended — is gone.

**"Do I need the planner?" — the owner's model of the cloud agent is
correct.** The Issue is the intake, the PR is the workbench. Copilot opens a
branch and PR, plans its own steps inside the session, writes its plan and
progress in the PR description, and is steered through `@copilot` on the PR.
What assignment does **not** do:

1. **Decompose.** One assignment, one PR. An epic becomes one large PR, which
   is harder to review and to send back for one wrong part.
2. **Write acceptance criteria.** The reviewer judges against them, so
   something still has to write them.
3. **Give the owner a look at scope before code exists.** In gladiator-engine,
   `AGENTS.md` reserves rule changes to the owner; the plan is where that is
   checked today.

The test the owner adopted: *would I want to review this as one PR?* If yes,
assign directly. If no, split first.

## 5. The proposed design

```
Issue opened ── human sets the intake marker
  └─ INTAKE  (read-only session: edits no code; may create Issues)
       ├─ PR-sized → write acceptance criteria + tier on the Issue
       │             → assign Copilot (customAgent: implementer, model from tier)
       └─ epic     → split into task Issues: criteria, tier, dependencies
                     → [optional human approval marker]
                     → assign Copilot to tasks with no open dependencies
                     → on each merge, assign the tasks it unblocked

Copilot works on its own PR, testing in its own session (setup steps install the toolchain)
  └─ PR leaves draft / Copilot requests review
       └─ CI: every deterministic check (lint, format, toolchain validation, tests)
            └─ all green → REVIEWER (read-only session; unchanged)
                 ├─ PASS → required check green → human approves and merges
                 └─ FIX  → comment "@copilot <findings>" → Copilot pushes
                           → full CI again (PR is no longer draft) → REVIEWER …
                           → after N rounds: escalate marker, stop
```

### 5.1 Intake

A planner whose degenerate plan is "one task, this one".

- **Trigger: a marker set by a person**, not every new Issue. gladiator-engine
  is public; anyone can open an Issue (SEC-5, HUM-1). At minimum, act only for
  authors with write access. Copilot Automations would have handled this
  filtering, but they're private-repo only.
- **Output is structured and validated before anything is created** (HND-4),
  exactly as the planner's is today: criteria non-empty, dependencies resolve,
  no cycles, sane count.
- **Writes the tier, not a model** (SES-8). One configurable place maps tier to
  the `model` passed at assignment.
- **Dispatches only unblocked tasks.** Assigning all of an epic's tasks at once
  produces PRs built on code that doesn't exist yet. A small workflow on merge
  assigns what the merge unblocked. gladiator-engine's `issue-dependencies.yml`
  is the starting point.
- **Owner's open decision: does a split wait for an approval marker?** The
  conversation's recommendation was yes at first, because splitting is where
  scope is decided; drop it once splits are reliably right. "Leave it as one"
  can auto-assign.
- **Needs a user token** to assign. gladiator-engine removed its last PAT
  (`PROJECT_TOKEN`) deliberately; this reintroduces one.

The planner and plan-reviewer prompts mostly carry over: what makes a good
task, dependencies, acceptance criteria. The dispatch machinery around them
does not.

### 5.2 Implementation and correction — the platform's agent

- Assign the Issue to Copilot with a slim `implementer` custom agent and a
  model resolved from the tier.
- Specialised knowledge (for gladiator-engine: `.tscn`/`.tres` serialization,
  the test ratchet, the rules boundary) moves into **skills**.
- `copilot-setup-steps.yml` must install the same toolchain and call the same
  validation entry point CI uses (INT-4). gladiator-engine's already installs
  Godot 4.7.2.
- Correction is `@copilot` on the PR, not a separate fixer session. The
  fixer's context is now the implementer's context; see the rule impact
  section.
- Retires: the scripted implementer (`agent-02-implement.yml`), probably the
  fixer workflow (`agent-05-fix.yml`), and most implementer/fixer model
  routing.

### 5.3 CI gating — draft is "still working", ready is "judge me"

The owner asked whether CI could run only when the author (human or machine)
says the PR is ready, whether that is what Draft means, and whether a failure
could push a PR back to draft.

- **Draft doesn't stop workflows by itself.** `pull_request` with default
  types fires on opened, synchronize and reopened, drafts included.
  gladiator-engine's `ci.yml` runs on every Copilot push today; only the
  reviewer waits for `ready_for_review`.
- **Gating is a trigger type plus a job condition:**
  ```yaml
  on:
    pull_request:
      types: [opened, synchronize, reopened, ready_for_review]
  jobs:
    test:
      if: github.event.pull_request.draft == false
  ```
  Gate in the **job**, not the trigger. A skipped job reports "skipped", which
  counts as reported; a filtered workflow reports nothing and required checks
  hang (INT-2). Every required check that skips on draft must also fire on
  `ready_for_review`, or a stale "skipped" is what merge protection sees.
- **Optionally, cheap checks on every push**, drafts included: formatters and
  linters, seconds each. Everything slow waits for ready.
- **Sending a PR back to draft is possible** (GraphQL
  `convertPullRequestToDraft`; `gh pr ready --undo`). ❓ Whether `GITHUB_TOKEN`
  may call it is untested.
- **Recommended instead: leave the PR ready on failure.** A failing required
  check already blocks merge, and the check *is* the explicit "finished and
  broken" marker GAT-10 asks for. Post the failure as `@copilot`; Copilot's fix
  push re-runs the full gate because the PR is no longer draft. That avoids
  draft flapping and doesn't depend on Copilot re-marking ready, which is
  unknown (❓ Q2).
- **The reviewer runs only after every deterministic check is green** (GAT-9).
  `needs:` only joins jobs within one workflow; gladiator-engine's checks are
  spread over `ci.yml`, `gdscript-lint.yml` and the reusable
  `godot-validation.yml`. Either consolidate, or trigger the reviewer by
  `workflow_run` and confirm all are green.
- **Don't review every push.** Review when Copilot marks ready or requests
  review, and after each fix round. Concurrency group with
  `cancel-in-progress`.
- **The verdict is a required status check**, so no PR merges without PASS
  regardless of comment traffic.
- **Repository setting:** allow Actions on cloud-agent PRs without manual
  approval, or nothing above runs.

### 5.4 Reviewer — kept, and extended

The owner chose to keep the reviewer as is: a read-only session, strong tier,
never shown the implementer's account (CTX-3). Note that Copilot writes its
plan and progress into the PR body, so the existing fetch list, which
deliberately excludes the PR body, matters more, not less.

Extension proposed by the owner: **trigger a review from a PR comment**
(`/review` or `@reviewer`). An `issue_comment` trigger gated on the
commenter's write permission (the repository is public). That gives a
chat-style loop: `/review` → verdict → `@copilot` → `/review`.

The owner's framing: *the reviewer can still tell Copilot to look at the
review afterwards.* That is the FIX → `@copilot` edge above.

## 6. Open questions

### Experiments — cheap, and the design depends on them

| # | Question | Why it matters | Test |
| --- | --- | --- | --- |
| ❓ Q1 | Does an `@copilot` comment posted by a workflow trigger Copilot? Under `GITHUB_TOKEN` it comes from `github-actions[bot]`; Copilot acts for users with write access. | The whole FIX loop. If only a user token works, the reviewer's comment-poster holds a user credential. | One throwaway Issue; post `@copilot` both ways. |
| ❓ Q2 | When Copilot finishes, does it take the PR out of draft, request review, or both, reliably? | The trigger for the full gate and the reviewer. | Same throwaway Issue; watch the PR's events. |
| ❓ Q3 | Do custom agent `tools:` and `model:` actually apply on GitHub.com? Which wins when `model:` in the profile disagrees with `model` at assignment? | Whether a read-only custom agent is possible on cloud, and where the tier really resolves. | Custom agent with `tools: [read, search]` told to write a file; assert it can't. Pin `model:`; read the session log. |
| ❓ Q4 | **Can the owner approve a PR Copilot opened at their request?** For Automations the docs say the creating user *can't* approve the resulting PRs. If the same holds for issue assignment, a solo-maintainer repository cannot satisfy MRG-1 with its own approval. | MRG-1 is the highest-consequence rule here. | Assign an Issue as the owner; try to approve the PR. |
| ❓ Q5 | Can `GITHUB_TOKEN` call `convertPullRequestToDraft`? | Only if draft push-back is wanted. | One workflow run. |
| ❓ Q6 | Does `model` in the assignment call work with a fine-grained PAT? (Community report says no.) | Which credential type SEC-1 has to tabulate. | Same call, both token types. |

### Decisions for the owner

- **D1** — Split approval: automatic, or wait for a marker?
- **D2** — Copilot's auto-escalation: what is the round cap before escalation,
  and what is the escalation marker? (`/execute-task` uses four rounds;
  gladiator-engine has `review:design-ambiguity`.)
- **D3** — Accept reintroducing a user token, and with what scope?
- **D4** — Consolidate deterministic checks into one workflow, or join them
  with `workflow_run`?

## 7. Rule impact

This repository's rules were written from the system this proposal would
change. The table is an honest first pass; challenge it.

| Rule | Effect | Notes |
| --- | --- | --- |
| **DEC-2** each role its own session | Holds | Intake, implement, review are separate sessions. Fix becomes a continuation of the implement session; see DEC-3. |
| **DEC-3** split only on tools, cost, or context | **Changes** | Fix stops being a separate role: same tools as implement, same context, and tier only via the `@copilot` model picker (web UI) or PR default. That is DEC-3 applied: with no difference left, fix and implement are one role. The *verdict* still separates rounds. |
| **DEC-5** no orchestrator in the pipeline (SHOULD) | **Tension** | Intake's output includes "assign now / split first", which is close to "which role runs next". Defence: it is a planner whose output is validated data, and automation does the dispatch (HND-4). A reviewer of this proposal should press on this. |
| **CAP-1** remove capability, don't instruct | Holds for intake and reviewer (CLI sessions, unchanged). **Open** for a cloud read-only custom agent: depends on Q3. |
| **CAP-5** no sub-agents | Holds, and the platform now enforces it (GitHub.com ✗). |
| **CAP-6 / SEC-3** sessions don't publish | **DEV** | The cloud agent pushes its own commits to its own branch. Containment: it can only push to `copilot/*`, Actions need approval or a setting, merge stays a human act, and MRG-3 must be checked for the Copilot identity. Record this in the deviation log. |
| **CTX-3** reviewer never sees producer's account | Holds; more important | Copilot writes into the PR body; the reviewer's fetch list must keep excluding it. |
| **CTX-4** implementer sees one item | Holds | One Issue per assignment. Copilot sees the repository, as the CLI implementer did. |
| **HND-2/3** item is the whole contract; cold start | Holds; more important | Copilot snapshots the Issue at assignment and ignores later comments. The Issue really is the whole contract. |
| **HND-4** plan validated before materializing | Holds | Intake keeps the planner's validation. |
| **DSP-1** work starts because a marker was set | Holds for intake (marker). Assignment is itself a settable attribute, from any client including mobile. |
| **DSP-7** no stage fires on its own output | Watch | Reviewer writes `@copilot`; Copilot pushes; push triggers reviewer. A loop by design, so HUM-3 is mandatory, not optional. |
| **SES-5** preference list walked in order (SHOULD) | **DEV** | Assignment takes one model. If it is unavailable, there is no next entry. ❓ What the cloud agent does then is unknown. |
| **SES-8** items carry a tier, not a model | Holds if the tier→model map lives in one configurable place used at assignment time. |
| **SES-9** tier set by the role that can judge it | Holds | Intake sets it. |
| **GAT-9** deterministic before any model | Holds; strengthened | Reviewer runs only on all-green. |
| **GAT-10** readiness asserted by validation | Holds | The failing required check is the "finished and broken" marker. Supports leaving the PR ready on failure. |
| **HUM-1** model spend needs a human act | Holds with stated exemptions: intake needs a marker; assigning unblocked tasks follows a merge, which is a human act; FIX→`@copilot` is bounded by HUM-3. Write each bound down. |
| **HUM-3** correction attempts capped | Required | See D2. |
| **HUM-5** every boundary interruptible | Holds if split approval exists (D1); weaker if splits auto-assign. |
| **INT-2** don't filter required-check triggers | Holds | Draft gating in jobs, not triggers. |
| **INT-4** one validation, three places | Holds if `copilot-setup-steps.yml` calls the same entry point as CI. |
| **MRG-1** machine verdict never sufficient | **At risk** | Depends on Q4. If the owner can't approve Copilot PRs they requested, a solo repository needs a second human or an outside identity. |
| **MRG-3** writer can't approve | Check | The Copilot identity and the user token used for assignment both need tabulating. |
| **SEC-1** narrowest credential per role | **Changes** | A user token for assignment (and possibly for posting `@copilot`, Q1). A fine-grained PAT needs actions, contents, issues and pull requests write, which is broad. |
| **SEC-5** untrusted input is data | Holds | Gate intake and `/review` on write access; public repository. |

## 8. Explicitly not decided

- Whether any of this lands in `templates/github-actions/` or only in
  gladiator-engine.
- Whether DEC-3's consequence (fix folds into implement) should become a rule
  change or stay a recorded deviation.
- Anything about the local Claude Code pipeline (`/execute-task` and friends).
  An `/execute-epic` command on top of the existing sub-agents was suggested
  and not pursued.
- The planner's fate beyond becoming intake.

## 9. Suggested order, if it goes ahead

1. Run Q1–Q4 on one throwaway Issue. Q4 can stop the design on its own.
2. Settle D1–D4.
3. Add `/review` to the reviewer workflow. Independent of everything else.
4. Pilot direct assignment on three to five PR-sized tasks with the slim
   implementer agent, model from tier, CI approval setting changed. Compare
   first-time PASS rate against the scripted implementer.
5. If it holds: build intake, draft-gate CI, wire FIX→`@copilot`, retire
   `agent-02-implement.yml` and `agent-05-fix.yml`, update the deviation log,
   and cut `docs/AGENT_WORKFLOW.md` down to match.

## Sources

GitHub documentation source, `github/docs@main`, read 2026-10-17:

- [Using Copilot cloud agent via the API](https://github.com/github/docs/blob/main/content/copilot/how-tos/use-copilot-agents/cloud-agent/use-cloud-agent-via-the-api.md)
- [Custom agents configuration](https://github.com/github/docs/blob/main/content/copilot/reference/custom-agents-configuration.md)
- [Using Copilot cloud agent on GitHub](https://github.com/github/docs/blob/main/content/copilot/how-tos/use-copilot-agents/cloud-agent/use-cloud-agent-on-github.md)
- [Changing the AI model for cloud agent](https://github.com/github/docs/blob/main/content/copilot/how-tos/use-copilot-agents/cloud-agent/changing-the-ai-model.md)
- [Customization cheat sheet](https://github.com/github/docs/blob/main/content/copilot/reference/customization-cheat-sheet.md)
- [Delegating and parallelizing work with agents](https://github.com/github/docs/blob/main/content/copilot/concepts/agent-capabilities/choosing-and-delegating-agent-work/delegating-and-parallelizing-work-with-agents.md)
- [About automations](https://github.com/github/docs/blob/main/content/copilot/concepts/agent-capabilities/agent-powered-workflows-and-operations/about-automations.md)
- [Creating automations](https://github.com/github/docs/blob/main/content/copilot/how-tos/use-copilot-agents/cloud-agent/create-automations.md)

Changelog and community:

- [Assign issues to Copilot using the API](https://github.blog/changelog/2025-12-03-assign-issues-to-copilot-using-the-api/) (Dec 2025)
- [Copilot cloud agent supports auto model selection](https://github.blog/changelog/2026-05-14-copilot-cloud-agent-supports-auto-model-selection/) (May 2026)
- [Community discussion #190228](https://github.com/orgs/community/discussions/190228) — `model` with a fine-grained token
- [gh-aw: Copilot cloud agent reference](https://github.github.com/gh-aw/reference/copilot-cloud-agent/)

In gladiator-engine: `docs/AGENT_WORKFLOW.md` (*The constraint that shapes
everything*, *Four entry points*, *Why planning and review are CLI
sessions*), `docs/AGENT_ROLE_DESIGN.md` (*The manager-delegates-to-specialists
shape*), `.github/workflows/ci.yml`, `agent-04-review.yml`,
`copilot-setup-steps.yml`.

---

## Review log

Append below. Date, who you are, what you checked, what you think. If you
change the body above, say what and why.

### 2026-10-18 — Claude Code (author of this write-up)

Written from the conversation itself. The rule impact table is a first pass by
the same agent that proposed the design, which is exactly the
reviewer-reads-the-author's-account problem CTX-3 warns about. Read it
sceptically. The claims I'm least sure of: the DEC-5 defence, and whether Q4
really blocks MRG-1 for issue-assigned PRs rather than only for Automations.
