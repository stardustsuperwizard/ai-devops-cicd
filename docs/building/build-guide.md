# Build guide

A phase-by-phase plan for building this architecture on whatever substrate you
have. Each phase is small enough for one working session, ends in a durable
artifact, and has a done-test you can run — which is, not coincidentally, the
property the architecture itself is built on.

It is written to be executed by a person or by an agent session, one phase at
a time.

**Before starting, read:**
[`../architecture/00-the-model.md`](../architecture/00-the-model.md) for the
entities and the pipeline,
[`../architecture/01-components.md`](../architecture/01-components.md) for the
component contracts, and
[`../../RULES.md`](../../RULES.md) for what must hold. If you read one page of
rationale, make it
[`../rationale/02-capability-removal.md`](../rationale/02-capability-removal.md).

**Fill in [`worksheet.md`](worksheet.md) first.** Every phase refers to
answers in it. A build that starts coding before the worksheet is filled in
reaches phase 4 and discovers its marker primitive cannot be set without admin
rights.

**Build [tier 0](../architecture/02-substrate.md#tier-0--the-minimal-realization)
first if you are unsure of anything.** It is the whole control plane in forty
lines of shell, it conforms, and confirming the shape there costs an afternoon
rather than a sprint.

---

## Phase 0 — Decide, and write it down

**Output:** a completed [`worksheet.md`](worksheet.md) committed to the repo.

Do not skip this because the answers seem obvious. The two that are never
obvious:

- **Which primitive carries the trigger marker** (**DSP-1**), and whether a
  non-admin can set it from a mobile client in two taps. If they cannot, the
  pipeline is not operable, and you find that out months in.
- **What your automation identity may not do** (**HUM-4**). There is always
  something — usually modifying its own configuration. That set defines a
  class of work no automated path can perform, and it has to be detectable at
  plan time rather than at dispatch.

**Done when:** every row of the worksheet is filled, and every missing
capability has a named degradation from
[`../architecture/02-substrate.md`](../architecture/02-substrate.md#degradations).

---

## Phase 1 — Marker vocabulary and bootstrap

**Output:** a re-runnable, idempotent bootstrap script; every marker exists.

Create:

```
agent:{role}:{vendor}     for role ∈ {planner, implementer, reviewer, fixer}
                          and each vendor you will support
plan / planned            intake state, mutually exclusive by construction
implementation            marks a task item
blocker                   trigger AND state — see 06-state-markers.md
review:pass | review:fix | review:planning-failure | review:design-ambiguity
validation:failed
model:cheap | model:middle | model:strong
test-removal-approved | characterization-test
dashboard | dashboard:update
```

Requirements:

- **Idempotent.** Re-running updates rather than erroring.
- **Never deletes.** A marker this script no longer creates must survive on a
  project that already has it.
- Creates the `agent:*` triggers explicitly — **no workflow ever creates
  those**, because humans write them. This is the specific reason the whole
  control plane is inert on a fresh project.

**Done when:** you can delete every marker, re-run the script, and the project
is operable again.

**Trap:** a fresh project with no markers produces **no errors and no logs**.
Nothing fires and nothing says why. This phase exists because of that silence.

---

## Phase 2 — The echo job

**Output:** setting one marker reliably produces one run that prints the item
ID, and the marker is gone afterwards.

Nothing else. No model, no prompt, no checkout.

**Done when:** you have added and removed the marker five times and got five
runs. Then add it on a mobile client and get a sixth.

**Do not proceed until this is boring.** Every later phase assumes dispatch
works, and debugging dispatch through a failing model session is miserable.

Also verify the negative: confirm that the job **removing** its own marker
does not trigger a second run. If it does, you have a loop and it will not be
free.

---

## Phase 3 — The session runner (C3)

**Output:** one component, one vendor, meeting the full contract in
[`../architecture/01-components.md`](../architecture/01-components.md#c3--run-session).

Build it with these inputs from the start, even with one vendor — retrofitting
them later means rewriting every caller:

`vendor`, `prompt-file`, `models`, `capability`, budget caps.

And these outputs, on **every** path including total failure: joined text,
final-message-only text, outcome JSON, duration, cost, failure JSON.

### The three tests that matter

1. **Capability, negative case.** Run a `read-only` session with a prompt that
   asks it to write a file. Assert the file does not exist. If it does, your
   capability knob is decorative — which is the failure mode in
   [`../rationale/02-capability-removal.md`](../rationale/02-capability-removal.md),
   and the additive/subtractive trap is the likely cause.
2. **Preference-list walk.** Put a deliberately invalid model ID first. Assert
   the run succeeds on the second entry, and that the log names the rejected
   ID. Then assert a *real* failure does **not** advance the list.
3. **Cost on failure.** Force a total failure. Assert duration and cost are
   still reported as numbers.

**Done when:** all three pass, and the prompt is passed by **file or stdin**,
never as a command-line argument.

---

## Phase 4 — The second vendor

**Output:** a second vendor works, and **nothing above C3 changed.**

That last clause is the whole test. If a caller had to learn about the new
vendor, the abstraction is wrong — go back and fix C3 rather than branching
upstream.

Watch for:

- **Additive vs subtractive tool policies** — the trap that fails silently.
- **Different model ID spellings for the same model.** Never copy IDs between
  CLIs. Dump the CLI's own model list into the run log so a rejected ID is
  self-diagnosing.
- **Different budget units** (credits vs turns). Not convertible. Tune both
  per role, by observation.

**Done when:** you can flip a role's vendor by changing one marker, and the
role behaves identically.

---

## Phase 5 — The reviewer, end to end

**Output:** a change proposal gets a real verdict marker and a real report.

The reviewer first, deliberately: it is **read-only**, so it cannot damage
anything, and it exercises C2 → C3 → C4 → C5 completely.

Build:

- **C2** fetching *only* the diff, the task item, and the acceptance criteria.
  **Explicitly do not fetch the proposal's description** — see
  [`../rationale/04-context-isolation.md`](../rationale/04-context-isolation.md).
- **C4**, the outcome classifier, per
  [`../rationale/08-session-outcomes.md`](../rationale/08-session-outcomes.md).
  Classify from harness evidence only.
- **C5**, the verdict extractor, with the truncation gate.

**The test that proves this phase:** feed the extractor a review whose text was
cut off mid-table but whose first line reads `VERDICT: PASS`. It must publish
a **failure**, not a pass. If it publishes the pass, the whole review stage is
theatre.

**Done when:** all four verdict values route somewhere different, and a
truncated session cannot publish.

---

## Phase 6 — The implementer

**Output:** a task item becomes a change proposal.

New machinery: write capability, branch creation, self-validation, and the
`validation:failed` marker.

Rules:

- The session gets **one** task item. Never the epic's task list.
- Mark the proposal ready **only if** the implementer's own validation passed.
  Otherwise leave it draft and set `validation:failed`.
- Per-task model tier, read from the item's `model:*` marker.

**Done when:** a failing validation leaves a draft proposal carrying
`validation:failed`, and a passing one leaves a ready proposal.

---

## Phase 7 — The planner

**Output:** an epic becomes task items that pass the cold-start test.

The planner is read-only and emits **structured data**, which the publisher
validates *before creating anything*:

- non-empty acceptance criteria on every task;
- every `depends_on` resolves within the plan;
- no cycles;
- scope and out-of-scope present;
- a sane task count;
- a `model:*` tier with written reasoning.

A plan that would create unexecutable items creates **none**, loudly.

**Done when:** you can hand a task item to someone who has read nothing else
and they can do the work and know when they are done.

---

## Phase 8 — The fixer, and the escalation cap

**Output:** a `review:fix` verdict becomes a bounded correction on the same
branch.

- Bounded to the verdict. Not a re-implementation.
- Escalate one tier per repeat round on the same proposal.
- **Cap it.** After 3 rounds, stop and escalate to a human. By round 3 the
  cause is usually an underspecified task item or a wrong design, and neither
  is fixed by a better model trying harder.
- `PLANNING FAILURE` goes to the planner, `DESIGN AMBIGUITY` to a human.
  Neither goes to the fixer. Enforce this in the dispatcher, not in prose.

---

## Phase 9 — Quality gates

Per [`../rationale/09-quality-gates.md`](../rationale/09-quality-gates.md), in
this order — each is independently useful, so ship them one at a time:

1. **Test ratchet** (easiest, catches the most common cheat)
2. **Validation-before-ready** (already built in phase 6; wire the marker)
3. **Red gate** (hardest; needs a merge-base checkout)
4. **Base-branch scheduled run**
5. **Deterministic-first lint fixer**

Every gate: read-only token, override marker read **live**, override procedure
printed in its own failure message, runnable locally.

---

## Phase 10 — The control plane

**Output:** one pinned, generated document; every state derived.

Build the renderer as a **local script first**, with a `--json` mode. Wire it
to CI second. A renderer you cannot run locally is a renderer you cannot test.

Get the ordering right —
[`../rationale/07-derived-state.md`](../rationale/07-derived-state.md) — and
clear the button unconditionally, even on failure.

**Done when:** `render --json` against the live tracker produces the same
states the document shows, and you have deleted the pinned document and
watched the next run recreate it.

---

## Anti-patterns, collected

Each of these was tried somewhere and cost real time.

| Anti-pattern | Why it fails |
| --- | --- |
| Telling a role not to do something it has the tools for | The harness wins the argument. Remove the tool. |
| One workflow per vendor | Three places to fix one role's bug |
| Branching on vendor above the session runner | The abstraction has leaked; it will leak further |
| Storing status on a board | Second source of truth; boards cannot cause work |
| Model IDs on work items | Items outlive vendor catalogues |
| Session-wide fallback that escalates *down* | Silently cheapens work that was deliberately tiered up |
| Classifying outcomes from model output | A session that *discusses* rate limits gets classified as rate-limited |
| Publishing a verdict from a truncated session | The verdict line comes first and survives truncation |
| Passing the prompt as a command-line argument | 128 KiB `MAX_ARG_STRLEN` cap; fails abruptly on diffs |
| Replacing the marker set instead of adding to it | Silently drops every other marker on the item |
| Trusting a replayed event payload for marker state | A marker added after a red gate is invisible to a re-run |
| Building the control plane before the roles | It derives from state that does not exist yet |
| An orchestrator agent delegating in-session | One session, one model; the tiering is gone |
