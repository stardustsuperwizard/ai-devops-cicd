# Proposal 0002 — Goals first: a framework that bends to the tools

| | |
| --- | --- |
| **Status** | Draft for discussion. Nothing decided. |
| **Origin** | The same owner/Claude Code conversation as [0001](0001-native-cloud-agent-dispatch.md), 2026-10-19 |
| **Relationship to 0001** | 0001 is one realization (GitHub, Copilot cloud agent) of the pattern described here. Read this first for the *why*; read 0001 for one concrete *how*. |
| **Names products** | Only as examples. The argument does not depend on any of them. |

## How to use this document

You are probably an agent asked to challenge or improve this. The owner's
stated goals in §1 are the fixed point; everything after is a proposal for
serving them, and is fair game. Append comments to the
[Review log](#review-log) rather than overwriting.

---

## 1. What the framework is for

In the owner's words (2026-10-19):

> Enable automated unattended cloud development so that a designer is
> managing workflows and not individual local coding sessions. Ensure that
> tasks are properly scoped so as to reduce the risk of session compaction and
> hallucination which result in code delivery that generates more problems
> than it solves. Efficiently spend AI financial budget on models that have
> the right level of size and effort to produce easily maintainable code.

And the trade-off, stated explicitly:

> High quality and inexpensive, at the expense of time.

Of *speed, quality, price — pick two*, this framework picks **quality and
price**. That choice is the most useful single design input in this document,
because it says what to spend when something has to give: **wall-clock time**.
Retries, review rounds, serialised tasks, waiting for a cheaper model's second
attempt — all acceptable. Spending more money to go faster is not.

### Three goals, restated as tests

| Goal | You know it's working when |
| --- | --- |
| **Unattended** — the designer manages work, not sessions | Work moves from intake to a mergeable proposal without the designer opening a coding session. The designer's actions are: write an intake item, answer escalations, approve merges. |
| **Well-scoped** — no task outgrows one session's attention | Sessions don't compact. Proposals don't contain work nobody asked for. A rejected proposal is rejected for a reason the reviewer can name, not because it went off the rails. |
| **Cost-efficient** — the right size and effort of model per task | Spend per merged task trends flat or down while first-pass review success holds. |

Everything else in the framework — roles, markers, verdicts, gates — earns its
place only by serving one of those three.

## 2. What the conversation changed

### The premise that started it was weaker than it looked

The conversation began with *"I want to pick the model I use for
development."* Followed through, that premise has a hidden requirement: to
choose models well you have to be an **informed consumer** of them — know
where the break-even points are between a cheap model's retries and an
expensive model's first attempt, per kind of task. The owner's honest
assessment: *"I generally know how the models work and the costs, but I do not
have a formula or the data."*

Without that data, fine-grained model routing is overhead that cannot be shown
to pay for itself. The machinery that supports it (per-role preference lists,
per-task tiers resolved to identifiers, escalation per fix round, fallback
walking) is real work to maintain — and its value is theoretical until
measured.

### The cheaper lever is task size, not model choice

This is the observation that ties the three goals together. **A small,
well-scoped task lets a cheaper model succeed.** The same work handed over as
one sprawling item needs a stronger model *and* still risks compaction and
drift. So:

- **Scoping is the main cost control.** Getting the task size right does more
  for spend than picking between models for a badly sized task.
- **Scoping is also the main quality control** — it is what the owner's second
  goal names directly (compaction, hallucination).
- **Model choice becomes a coarse default**, not a per-task decision: whatever
  the platform offers by default (often an automatic picker, sometimes
  discounted), or one or two tiers, with the reviewer as the backstop.

The time-for-money trade makes this safe: if a cheap model misses, the cost of
that is a review round and some wall-clock time, which §1 says is the
acceptable currency.

### Fine-grained routing is an enterprise feature, and that's fine

Someone running hundreds of tasks a week on a larger budget may have the data
and the reason to do the break-even analysis, and for them the routing
machinery pays for itself. For a solo designer on project-scoped work, it
doesn't yet. The framework should offer it **as an option you grow into**, not
a baseline you must operate.

A middle path that costs nearly nothing: **record, don't route.** Keep logging
what each task cost and how many review rounds it took (the existing ledger
idea, OBS-6). If the data ever shows a pattern — say, a class of task where the
cheap default fails three times out of four — that is when routing earns a
place, with evidence behind it.

## 3. Principle: rules are known costs, not contracts

The owner's concern: *"I do not want something so rigidly laid out that we
can't pivot or improve without violating a contract that requires a committee
to change."*

The current rule set already leans this way — its own deviation log says *"the
rules are not the goal; knowing which you broke is."* But its MUST/SHOULD
language and the requirement that every deviation on a MUST have a named owner
and a date read as a compliance regime. For a solo designer, that is a
committee of one filling in forms for themselves.

Proposed reframing:

1. **Every rule is a priced option.** Each rule already states *Why* and
   *Fails as*. Read together, those are a price: "skip this, and here is what
   you will see go wrong." Skipping a rule is a choice with a known cost, not
   a violation.
2. **Profiles instead of one bar.** The conformance document already defines
   levels 0–4. Make the profiles explicit and goal-led:
   - **Small project** (solo designer, project-scoped work): the load-bearing
     handful plus a human merge. Platform-native agents welcome. Model choice
     is a default.
   - **Team / enterprise**: add measured routing, per-role credentials,
     substitutability, the full gate set.
   A project picks a profile and moves up when something actually breaks.
3. **Deviations are notes, not tickets.** One line: what we do instead, and
   why. The owner-and-date requirement belongs to the enterprise profile.
4. **Gates fit the framework, not the other way round.** A gate is added when
   a failure it prevents has actually happened or is expensive enough to
   prevent pre-emptively. "The rule says so" is not on its own a reason.

What should stay firm, even in the small profile — the short list where
skipping it defeats a goal in §1 rather than just costing something:

| Keep | Because it serves |
| --- | --- |
| **Tasks scoped to one session and judged cold** (HND-2/3) | Well-scoped. This *is* the second goal. |
| **Review is a separate session that can't edit and doesn't read the author's account** (DEC-2, CAP-1, CTX-3) | Quality. An agent marking its own work is not review. |
| **Deterministic checks before any model** (GAT-9) | Price. Never pay a model to find what a linter finds free. |
| **Correction rounds are capped** (HUM-3) | Price. Time is cheap; an endless loop is not time, it is money. |
| **A human merges** (MRG-1, MRG-6) | Unattended work still lands under a person's name. |

That is five ideas, not ninety-eight rules. The rest are available, priced,
and optional until the project's scale makes them worth their upkeep.

## 4. Vendor neutrality lives in the handoffs

The owner's worry: conventions so specific that a capable tool can't be used
because it doesn't follow the specification to the letter.

The answer is to make the *handoffs* neutral and leave everything inside a
stage to whatever tool runs it:

```
intake item  ──▶  scoped task item(s)  ──▶  change proposal  ──▶  verdict  ──▶  human merge
  (designer)        (scoping stage)         (any capable        (review         (designer)
                                             agent or person)    stage)
```

If a tool can **read a task item and produce a change proposal**, it can do
the implement stage. If it can **read a proposal against its task and write a
verdict**, it can review. How it does that internally — its own planning, its
own sub-steps, its own prompt format — is its business.

This is what makes 0001 possible: GitHub's cloud agent plans inside its own
session and uses its PR as a workbench. Under a rigid reading of the current
rules it "violates" several (it pushes its own commits; correction happens in
the same session). Under this reading it simply fills the implement stage with
its own internals, and the questions that matter are the five in §3.

### Dispatch methods

A neutral orchestrator needs only a small table of *how* each tool can be
handed a stage. The current framework knows one kind well (a CLI session the
pipeline runs itself). The conversation added others:

| Method | Example tools | What you control | Overhead |
| --- | --- | --- | --- |
| **Native assignment** — hand the task item to the platform's hosted agent | Copilot cloud agent; equivalents on other platforms | Usually: model or "auto", agent profile, base branch | Lowest. The platform runs the session. |
| **Mention** — address an agent in a comment on a proposal | `@copilot`, `@claude`-style apps | The comment text | Low |
| **Pipeline-run session** — CI starts a CLI agent with a built prompt | Copilot CLI, Claude Code, Codex CLI, others | Everything: model list, tools, budget caps | Highest. You maintain the runner. |
| **A person** | The designer | Everything | Your time |

Per stage, a project picks a method. Small-profile default: native assignment
for implement and correct, pipeline-run session for scoping and review (where
removing write capability matters and platform agents tend to want to write).

## 5. Prompt documents

"Prompt document" is the umbrella term for everything that instructs an agent:
repository instructions, agent profiles, skills, slash commands, specs written
for agents to read.

The neutrality problem here is mostly **file names and locations**, and the
formats are converging:

| Kind | Locations different tools read today (examples) |
| --- | --- |
| Repository instructions | `AGENTS.md`, `CLAUDE.md`, `.github/copilot-instructions.md` |
| Agent profiles | `.github/agents/*.agent.md`, `.claude/agents/*.md` |
| Skills | `.claude/skills/`, `.github/skills/`, `.agents/skills/` (several tools read more than one) |
| Commands | `.claude/commands/`, `.github/prompts/` |

Proposed convention:

1. **One canonical copy of each prompt document.** Write it once, in plain
   Markdown, in a tool-neutral location (`AGENTS.md` is the closest thing to a
   shared convention for instructions; a neutral skills directory for skills).
2. **Per-tool stubs that point to it**, or a small script that generates
   them. The production example already does the first: its `CLAUDE.md` is a
   pointer to `AGENTS.md`.
3. **Prefer formats several tools already read** (the `SKILL.md` folder shape
   is spreading) over formats only one does.
4. **Keep a profile's frontmatter minimal**, and treat tool-specific fields
   (`model:`, `tools:`, `handoffs:`) as hints that a given tool may ignore.
   Nothing load-bearing should depend on a field only one tool honours —
   capability removal belongs in the dispatch method, not in a prompt file.

What a prompt document should contain is unchanged: what the stage is for,
what "done" means, what it must not do (with capability removal as the
actual control), and the project knowledge it needs.

## 6. Where things live

| | Lives in | Contains |
| --- | --- | --- |
| **The framework** | `ai-devops-cicd` | Goals (§1), the short firm list and the priced rules (§3), profiles, the dispatch-method table, prompt-document conventions, and reusable automation that projects *call* rather than copy (e.g. shared workflows and actions referenced by version). |
| **An instance** | Each project (e.g. gladiator-engine) | Its prompt documents (domain spec, engine specifics), its chosen profile and dispatch methods, its model default, and thin automation files that call into the framework. |

Calling shared automation by version, instead of copying 22k lines into each
project, is what addresses the owner's maintenance concern: improvements land
once, and a project pins the version it trusts.

## 7. What this means for the existing system

Honest summary, for the owner to weigh:

- **Keep**: task scoping (the planner's knowledge, reshaped as an intake
  stage), the reviewer, deterministic gates, the capped loop, human merge,
  the cost ledger as *record, don't route*.
- **Make optional (enterprise profile)**: per-role model preference lists,
  per-task tier→identifier routing and per-round escalation, multi-vendor
  runner abstraction for the implement stage, per-role credentials, the full
  98-rule conformance bar.
- **Replace where the platform does it**: the scripted implementer and fixer,
  with native assignment and mentions (0001).
- **Decide later, with data**: whether model routing ever comes back for a
  class of task.

## 8. Open questions

1. **Is "record, don't route" enough?** What are the two or three numbers
   worth logging per task (cost, review rounds, first-pass PASS?) so that a
   later routing decision has evidence?
2. **Who sizes tasks, and how is size judged?** If scoping is the main lever,
   the intake stage's sizing judgement is the most important prompt in the
   system. What does "one session's worth" mean concretely — files touched,
   acceptance criteria count, estimated diff size?
3. **Should RULES.md itself change** (MUST → priced options, profiles), or
   should this live in a separate "how to adopt" document and leave the rules
   as the reference? The second is less disruptive; the first is more honest
   about how the framework is meant to be used.
4. **How much of `templates/github-actions/` becomes callable shared
   automation** versus staying copy-paste reference?

---

## Review log

Append below. Date, who you are, what you checked, what you think.

### 2026-10-19 — Claude Code (author)

Drafted from the owner's stated goals and the conversation recorded in 0001.
The claim I'd most like challenged is §2's "task size is the cheaper lever
than model choice". It is plausible and matches the owner's experience, but
the framework has no data that demonstrates it yet — which is exactly the
argument for keeping the ledger.

### 2026-10-19 — Claude Code, from a first adoption

Checked against [examples/jrpg-battle](../../examples/jrpg-battle/README.md),
a one-owner, Claude-only project that adopted the small profile the same day.
Its evidence is thin: one task reviewed (interactively, PASS first time) and
no live Actions session yet. Read what follows as one adopter's experience,
not data.

- **Q1 (what to record).** It records model, outcome, cost, duration and turns
  per session in a hidden comment marker, plus the review round count from
  verdict markers. First-pass PASS falls out of those. That seems enough to
  start; the missing piece is the ledger that reads them (OBS-6).
- **Q2 (who sizes).** The planner session proposes, a validator enforces the
  mechanical parts (≤ 8 tasks, checkable criteria, dependencies resolve) and
  the owner approves with a second label. "One session's worth" ended up as
  *one PR a reviewer reads in one sitting, criteria provable without asking*.
  Still a judgement, and §2's "task size beats model choice" is still
  unmeasured here.
- **Q3 (change RULES.md?).** Leaving the rules alone worked: the adopter cited
  rule IDs in its own docs and recorded six deviations with costs. But the
  profile has a hole at level 0. MRG-2 is unholdable on a private GitHub Free
  repository, and the profile doesn't say what to do then. That belongs in the
  adoption document, not RULES.md.
- **Q4 (shared automation?).** The adopter copied ideas, not files: its
  control plane is ~1,700 lines against the template's ~22,000. On the way
  it found the template's session runner installing the CLI unpinned
  (INT-8), and made its own mistake that a shared, tested action would have
  caught once for everyone: a check-name collision that lets a skipped job
  read as the verdict (see the example). Both argue for a small callable
  action with its own tests over copy-paste, at least for the session runner.
