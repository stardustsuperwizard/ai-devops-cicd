# Conformance

How to tell whether what you built is this architecture, and where it is not.

This is a self-assessment. Nothing certifies anything. Its value is that the
answers are **checkable** — you run something, or point at a line — rather
than asserted.

## The load-bearing six

A system holding these is recognisably this architecture even if it holds
nothing else. A system breaking any of them is a different architecture and
will fail in the ways the rest of the rules were written to prevent.

| Rule | Check | Broken looks like |
| --- | --- | --- |
| **DEC-1** Roles are lifecycle stages | Name the artifact each adjacent pair exchanges | Agents messaging each other; no retryable boundary |
| **DEC-2** One session per role | Count sessions per run; it equals stages executed | One model's cost applied to every role |
| **CAP-1** Capability removed, not requested | *If the model ignored this, what would stop it?* | A role doing the forbidden thing intermittently |
| **CTX-1** Isolation by not fetching | Print each prompt; find the forbidden item | Reviews that agree with the author's reasoning |
| **HND-1** Durable artifacts at boundaries | Kill a session; is the next stage still runnable? | A pipeline that restarts rather than resumes |
| **HND-3** Cold-start test | Hand an item to someone who read nothing else | Tasks only their planner understands |

Anything failing here is not a gap to schedule. It is the thing to fix first.

## Levels

### Level 1 — Structurally sound

The load-bearing six, plus:

- **CAP-3** — capability translated per runtime, verified in both postures by
  asserting a `read-only` session cannot write
- **DSP-2** — triggers consumed, so re-setting is a clean retry
- **DSP-7** — no stage triggers on its own output
- **HND-4** — structured planning output validated before anything materializes
- **HUM-1** — starting a session on a new decision is a human act

At level 1 the pipeline is correct but manual, and you should be able to
explain every stage to someone in ten minutes.

### Level 2 — Operationally honest

Level 1, plus the rules that stop it lying to you:

- **OUT-3** — classification from harness evidence, never the model's answer
- **OUT-4/OUT-5** — a truncated session never publishes
- **OUT-6** — verdicts distinguish where the fault lies
- **GAT-10** — readiness asserted by validation, not by a session's report
- **OBS-1/OBS-3** — state derived; a failed render is stale, never false
- **HUM-2/HUM-3** — undecidable verdicts route to people; corrections are capped

Level 2 is the point at which you can believe what the system tells you. Most
implementations that feel unreliable are level 1 systems missing **OUT-3** and
**OUT-5**: they are not unreliable, they are reporting confidently about
sessions that did not finish.

### Level 3 — Substitutable

Level 2, plus:

- **SES-1** — runtime differences in exactly one component
- **SES-2** — program and payer resolved independently
- **SES-6/SES-7** — the list advances only on unavailability, and never cheapens
- **SES-8** — items carry a tier, never a model identifier
- **HND-6** — contracts name no tool
- **DSP-6** — routing encoded in the marker

At level 3 you can change agent vendor, model, or payer without touching
anything but configuration — and hand a work item to a person instead.

### Level 4 — Measured

Level 3, plus **OBS-6** (the ledger), **OBS-7** (the pipeline's own logic
tested), and the full **GAT** set.

At level 4 you can answer *which role fails most, at which tier* from data,
which is the first point at which tuning beats guessing.

## Self-assessment

Answer with a command, a file, or a line number. "Yes" on its own does not
count.

**Decomposition**
- [ ] Every adjacent stage pair: name the artifact exchanged
- [ ] Sessions per run == stages executed
- [ ] Table of every role's posture, tier and fetch list — no two rows identical
- [ ] Every role: point at the code consuming its output

**Capability**
- [ ] A `read-only` session asked to write a file: the file does not exist
- [ ] A `write` session asked to write a file: it does
- [ ] Capability omitted → `read-only`
- [ ] The delegation tool is absent from both postures
- [ ] Runtime tool-flag syntax appears in exactly one file

**Context**
- [ ] Each assembler names its fields; no wildcard fetches
- [ ] The reviewer's fetch list excludes the producer's account of its work
- [ ] The implementer's prompt contains no sibling task list

**Handoff**
- [ ] Kill a session mid-run; the next stage is still runnable
- [ ] Three random items pass the cold-start test with a real person
- [ ] The validator rejects each failure mode in
      [`03-interfaces.md`](03-interfaces.md#i2a--the-planners-structured-output)
- [ ] Three random items name no tool, agent, or command

**Dispatch**
- [ ] Every stage dispatched from a mobile client, tracker UI only
- [ ] Set a trigger twice → two runs; the clearing triggers nothing
- [ ] Every marker classified trigger / state / button
- [ ] For each stage, writes ∩ triggers == ∅
- [ ] Delete the marker vocabulary, re-run bootstrap, still operable
- [ ] Set three markers, have a stage write a fourth, four remain

**Session**
- [ ] Runtime names outside the session runner are strings, not branches
- [ ] Changing payer alone changes no tool policy, model, or prompt
- [ ] An unavailable first entry → succeeds on the second
- [ ] A genuine failure → the list does **not** advance
- [ ] Every fallback chain is non-decreasing in capability
- [ ] No model identifier appears on any work item
- [ ] A prompt larger than the single-argument limit works
- [ ] After a `write` session, the diff contains no prompt file

**Outcome**
- [ ] The classifiers' output keys are identical
- [ ] A successful session discussing every failure mode → `completed`
- [ ] A truncated review whose first line passes → publishes a failure
- [ ] Cross-fed vocabularies → loud failure
- [ ] A total failure still reports duration and cost

**Gates**
- [ ] Each gate runs from a shell against a local checkout
- [ ] Each gate's credentials are read-only
- [ ] "Could not decide" is distinct and not overridable
- [ ] Fail a gate, set the override, re-run → passes
- [ ] The failure output states that procedure

**Observability**
- [ ] Delete the rendered output, re-render → identical
- [ ] Kill a render mid-run → stale with a timestamp, not wrong
- [ ] An item matching several conditions lands in the documented bucket
- [ ] From the ledger: which role fails most, at which tier?

**Human authority**
- [ ] Every path that starts a session without a human act has a written bound
- [ ] Dispatching a correction against an undecidable verdict is refused
- [ ] The correction cap exists and escalation is a defined action
- [ ] Undispatchable work is flagged from declared scope, not by memory

## Common shapes of non-conformance

Ranked by how often they appear and how quietly they fail.

**1. Instructions where capabilities belong.** The role has the tool and is
asked not to use it. Fails intermittently — which reads as model variance, so
the instruction gets rewritten more firmly instead of removed. *Fix: remove
the tool.*

**2. The verdict believed before the outcome.** The review stage looks like it
works. It publishes passes from sessions that ran out of budget mid-table.
Nothing ever errors. *Fix: gate on the outcome first.*

**3. One session, four personas.** Saves plumbing, loses the tiering, the
capability postures and the retryability at once. Usually justified as
simpler, and it is — it is simpler because it is not this architecture. *Fix:
split, starting with review, which is read-only and cannot break anything.*

**4. Status stored rather than derived.** Works until a write fails, then
shows something false and keeps showing it. *Fix: derive at render time.*

**5. Classification from the model's answer.** A session that discusses rate
limiting gets classified as rate-limited, and retried. *Fix: classify from
exit status and error stream only.*

**6. Runtime conditionals above the session runner.** Appears in one workflow,
then a second, then a third, and switching vendor becomes a migration. *Fix:
push the branch down into the one component that owns it.*

**7. Pass/fail verdicts.** Contract failures route into the correction loop
and burn every escalation round producing nothing. *Fix: four values, routed
differently.*

## Recording deviations

Every real system violates something. The rules are not the goal; knowing
which you broke is.

For each deviation record: the rule ID, what you do instead, why, and what you
expect it to cost. Put it where someone touching that code will read it — not
in a separate document they will not open.

A deviation with a reason is a decision. A deviation without one is an
accident nobody has noticed yet, and most of these rules exist because
somebody could not tell the difference.
