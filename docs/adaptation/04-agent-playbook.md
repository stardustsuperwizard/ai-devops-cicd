# Agent playbook

Prompts to hand your agent companion, one per phase.

Each is written as the same kind of contract the pipeline itself uses — inputs
it may read, an output artifact, acceptance criteria, and what it must **not**
do. That is deliberate: if a cold contract cannot get an agent through a
phase, it will not get one through a task either, and you would rather find
that out here.

**Use them in order.** Each phase's output is the next phase's input, so a
skipped phase leaves the next one guessing.

## Before you start

**Give the agent the reference.** Clone or fetch this repository so it can
read [`../../templates/github-actions/`](../../templates/github-actions/)
directly. Every prompt assumes it can open those files. An agent working from
a summary of the reference will produce a summary of the port.

**Keep the survey open.** [`01-survey.md`](01-survey.md) is the shared state
between phases. The agent appends to it; you correct it.

**Two things the agent must never decide alone**, stated in the prompts and
worth stating here:

- **The marker primitive** (S-A1). It depends on who has admin, what a schema
  change costs, and whether people work from phones — none of which is in any
  repository, and an agent will pick the one that reads best in the docs.
- **Anything in group G** (the merge gate). Getting it wrong has no symptom:
  everything is green and the system is certifying its own output.

---

## Phase 0 — Survey

```text
You are helping port an agentic development pipeline onto our tools.

READ
  docs/PIPELINE.md                  — what the pipeline is
  docs/adaptation/01-survey.md      — the form to fill in
  docs/architecture/02-substrate.md — the eight capabilities and their
                                      degradations

DO
  Interview me to fill in 01-survey.md. Ask about one section at a time and
  wait for my answer before moving on.

  For every capability I cannot supply, name the degradation from
  02-substrate.md rather than inventing one.

OUTPUT
  A completed 01-survey.md, committed.

ACCEPTANCE CRITERIA
  - Every row has an answer, or a named degradation.
  - The two questions marked "never obvious" are answered in my words,
    not inferred.
  - The toolchain adapter table names real commands I have run.

DO NOT
  - Choose the marker primitive. Present the candidates with their
    trade-offs and let me decide.
  - Fill in an answer you inferred from the repository. If I have not told
    you, ask.
  - Start writing code.
```

**Why an interview rather than a form.** An agent handed a blank form fills it
with plausible defaults. Answering one section at a time with a human present
is the difference between a survey that records decisions and one that records
guesses.

---

## Phase 1 — Tier 0

```text
READ
  docs/architecture/02-substrate.md, section "Tier 0"
  docs/adaptation/01-survey.md (our answers)

DO
  Build the tier-0 control plane in our repository: a backlog directory of
  work items, four role prompts, and one dispatch script.

  Use our real agent CLI and our real toolchain commands from the survey.
  Not the reference's.

OUTPUT
  A working .pipeline/ directory. One command runs one role against one
  work item.

ACCEPTANCE CRITERIA
  - `.pipeline/run review TASK-001` runs a real session and writes a
    transcript, an outcome, and a ledger row.
  - The review role's prompt does NOT contain the branch's own description.
    Show me the assembled prompt and point at where that is enforced.
  - A read-only role cannot write a file. Demonstrate this: run one with a
    prompt asking it to create a file, and show me the file does not exist.
  - The ledger row is written even when the session fails.

DO NOT
  - Touch our CI system yet.
  - Add anything the reference tier-0 script does not have.
```

**Why before anything else.** Forty lines of shell, an afternoon, and it
conforms. Discovering the shape is wrong here is very much cheaper than
discovering it inside your platform's configuration — and the third acceptance
criterion catches the additive/subtractive trap (S-D4) before it can cost you
days.

---

## Phase 2 — Seam translation

```text
READ
  docs/adaptation/02-seam-catalogue.md
  templates/github-actions/**        — the reference, in full
  docs/adaptation/01-survey.md

DO
  Work the catalogue. For every seam, fill one row of the table at the end
  of that document:

    | Seam | Our equivalent | Applies? | Verified how | Deviation |

  For each, translate the "Means" line, not the "Does" line. Where a seam
  does not apply to our platform, say so and say why.

  Where you are NOT confident, say so in the row rather than guessing. A row
  marked uncertain is useful; a confident wrong row is not.

OUTPUT
  docs/adaptation/seam-translation.md — the filled table, committed.

ACCEPTANCE CRITERIA
  - Every seam has a row.
  - "Verified how" is a command I can run or an observation you made, never
    "looks equivalent".
  - The five high-risk seams (S-C2, S-D4, S-C8, S-F4, group G) each have a
    paragraph, not a table cell.
  - Every dropped seam has a recorded reason.

DO NOT
  - Write any pipeline code yet.
  - Decide anything in group G — flag those for me.
```

**Why a separate phase.** The translation is the artifact the rest of the port
is built from. Producing it as a side effect of writing code means it is never
written down, and the reasoning is lost the moment the session ends.

---

## Phase 3 — The merge gate

```text
READ
  RULES.md, sections MRG and INT
  docs/architecture/04-conformance.md, "Level 0"
  docs/adaptation/seam-translation.md, group G

DO
  Tell me exactly what to configure, as a numbered list of settings in our
  platform's UI or API. I will apply them; you will not.

  Then tell me how to verify each one by attempting the forbidden action.

OUTPUT
  A checklist I can work through, plus the verification steps.

ACCEPTANCE CRITERIA
  The list, once applied, makes all of these true and verifiable:
  - A change with a passing machine verdict and no human approval cannot
    be merged.
  - A direct push to the integration branch is refused.
  - The identity our agents use cannot approve a review.
  - The identity our agents use cannot merge.
  - Exactly one aggregate check is what protection names.
  - For each: the exact action to attempt, and what refusal looks like.

DO NOT
  - Apply any of it yourself, even if you have the access.
  - Proceed to phase 4 until I confirm every item verified.
```

**Why here, before any agent runs.** This is conformance level 0. A pipeline
missing it is an unreviewed-code-merging machine with an agent attached, and
everything built after this point makes it faster.

The agent proposes and does not apply — partly because it usually lacks the
access, and mostly because a human who has not personally verified the merge
gate does not actually know it holds.

---

## Phase 4 — CI and the adapters

```text
READ
  templates/github-actions/.github/workflows/ci.yml
  the four adapter files in templates/github-actions/.github/
  docs/adaptation/seam-translation.md, groups F and H

DO
  Build our CI pipeline: the aggregate check, and the four toolchain
  adapters using the commands from the survey.

OUTPUT
  A working CI pipeline with one aggregate check.

ACCEPTANCE CRITERIA
  - Add a deliberately failing job: the aggregate goes red and merge is
    blocked, with no settings changed.
  - A prose-only change reports rather than hangs.
  - A file in a new top-level directory still triggers validation.
  - Remove the toolchain: the output says nothing RAN, distinct from a
    failing build.
  - project-validate.sh runs from my shell on a local checkout.

DO NOT
  - Add the agent-specific gates yet (ratchet, red gate) — phase 7.
  - Let validation live in more than one place. One definition, called by
    every caller.
```

---

## Phase 5 — The session runner

```text
READ
  templates/github-actions/.github/actions/run-agent-session/action.yml
  templates/github-actions/.github/scripts/classify-*-outcome.py
  docs/adaptation/seam-translation.md, group D

DO
  Build the session runner for ONE runtime. Include every input and output
  the contract names, even the ones one runtime ignores — retrofitting them
  means rewriting every caller.

OUTPUT
  One component: capability, models, budget in; text, final message,
  outcome, duration, cost out.

ACCEPTANCE CRITERIA
  - A read-only session asked to write a file: the file does not exist.
  - A write session asked to write a file: it does.
  - Capability omitted defaults to read-only.
  - An unavailable model first in the list: succeeds on the second, and the
    log names the rejected one.
  - A genuine failure: the list does NOT advance.
  - A total failure still reports duration and cost as numbers.
  - A prompt larger than our single-argument limit works.
  - A session whose ANSWER discusses every failure mode by name still
    classifies as completed.

DO NOT
  - Read the model's answer to classify how the session ended. Exit status
    and error stream only.
  - Let any caller pass runtime tool flags.
```

**The last acceptance criterion is the one to insist on.** It is the difference
between a classifier that reads harness evidence and one that pattern-matches
the model's prose — and the second kind looks correct until a session
discusses rate limiting.

---

## Phase 6 — Review, end to end

```text
READ
  templates/github-actions/.github/workflows/agent-04-review.yml
  templates/github-actions/.github/actions/build-review-request/action.yml
  templates/github-actions/.github/actions/extract-review-verdict/action.yml
  docs/adaptation/seam-translation.md, groups A, C and E

DO
  Build the review role end to end: dispatch, prompt assembly, session,
  classification, verdict publication.

  Review first because it is read-only and cannot damage anything, and it
  exercises every component.

OUTPUT
  Setting a marker on a change proposal produces a published verdict.

ACCEPTANCE CRITERIA
  - The assembled prompt does NOT contain the proposal's own description.
    Show me the fetch call and point at the omission.
  - A truncated review whose first line says PASS publishes a FAILURE.
    Construct that input and show me.
  - All four verdict values route somewhere different.
  - Setting the marker twice produces two runs.
  - The marker is cleared even when the run fails.
  - Setting three markers, then publishing a verdict, leaves four markers.
  - Dispatch works from a mobile client with no terminal.

DO NOT
  - Give the review role any edit capability.
  - Parse the verdict comment for state. The marker is the state.
```

---

## Phase 7 — The rest

Implement, plan, correct, the agent-specific gates, the ledger, the control
plane — in the order [`03-procedure.md`](03-procedure.md) gives.

Each phase follows the same shape. The template:

```text
READ
  <the reference files for this component>
  docs/adaptation/seam-translation.md, group <X>

DO
  <the component>

OUTPUT
  <the artifact, and where it is committed>

ACCEPTANCE CRITERIA
  <from docs/architecture/04-conformance.md and the rules this component
   is cited under — checkable, each one a command or an observation>

DO NOT
  <the capability this component must not have, and the context it must
   not receive>
```

---

## Phase 8 — Prove it

```text
READ
  docs/adaptation/05-equivalence-tests.md
  docs/architecture/04-conformance.md

DO
  Run every equivalence test against our port. For each, record the exact
  command or observation and the actual result.

  Then run the conformance self-assessment.

OUTPUT
  docs/adaptation/conformance.md — the results, including failures.

ACCEPTANCE CRITERIA
  - Every test has a result, not a prediction.
  - Every failure is recorded as a failure. Do not fix and re-report as
    though it passed — record both.
  - Every deviation is in 06-deviation-log.md with its reason.

DO NOT
  - Mark a test passed because the code looks like it should pass. Run it.
  - Report a clean sweep. If everything passed, you did not run them —
    tell me which you could not run and why.
```

**The last line is not a joke.** A port that reports no findings has not been
assessed, and an agent asked to self-assess will tend toward a clean sweep.
Asking explicitly for what could not be run is what surfaces the tests that
were quietly skipped.

---

## Running the pair well

**Correct the survey, not the code.** When the agent gets something wrong, the
usual cause is a survey answer that was vague. Fix it there and the correction
propagates to every later phase.

**Ask for the assembled prompt, repeatedly.** It is the single most revealing
artifact in the port, and the place isolation failures are visible. "Show me
what the reviewer actually received" should be a reflex.

**Treat a confident answer about your platform with suspicion.** The agent has
read the reference and inferred the rest. Anything it says about *your* tools
is a hypothesis until someone runs it — particularly whether a write operation
adds or replaces (S-A3, S-C3) and whether a runtime is additive or subtractive
(S-D4).

**Let it push back.** The agent has read the reference more carefully than you
have. "The reference does this for a reason and you have dropped it" is the
most useful thing it can say, and it will only say it if you have not been
overriding it on things it was right about.
