# Rules

The normative rules for an agentic development pipeline. They constrain the
**architecture**, not the language you write in, the agent you run, or the
services you run it on.

Every rule is stated so you can check it. If a rule cannot be violated by any
choice available to you, it does not apply — say so and move on. If you
violate one deliberately, record which one and why; that record is worth more
than the compliance.

## How to read a rule

**MUST** — violating it breaks a property the architecture depends on.
Something downstream will fail, usually silently.
**SHOULD** — violating it costs you something real. Do it knowingly.
**MAY** — a choice, recorded so it is not made twice by accident.

Each rule carries **Why** (the property it protects), **Fails as** (what you
will actually observe when it is broken — usually not an error message), and
**Verify** (how to check, without trusting anyone's word).

Rule IDs are stable. Cite them in commits, reviews and design docs.

## Vocabulary

Terms are defined in [`docs/architecture/00-the-model.md`](docs/architecture/00-the-model.md).
In brief: a **role** is a stage of the lifecycle; a **session** is one
execution of an agent; an **artifact** is durable, addressable text; a **work
item** is the unit of assignable work; a **marker** is a small mutable
attribute on a work item; a **substrate** is whatever tracker, CI and agent
runtime you happen to have.

---

## DEC — Decomposition

### DEC-1 — Roles are lifecycle stages, not disciplines — MUST
Decompose along the axis *plan → implement → review → fix*, not *frontend /
backend / docs / data*.
**Why.** Lifecycle stages have a fixed order and each owes the next a defined
artifact. Disciplines have neither, so their coordination falls back into one
session's context.
**Fails as.** Agents that message each other instead of writing artifacts; no
retryable stage boundary anywhere.
**Verify.** For each adjacent pair of roles, name the artifact one hands the
other. A pair with no artifact is not a pipeline boundary.

### DEC-2 — Each role executes as its own session — MUST
No role delegates to another role inside one session.
**Why.** A session has one model and one tool policy. In-session delegation
runs every delegate at the delegator's cost tier and capability.
**Fails as.** The cost of the most expensive role, applied to all of them; the
read-only roles quietly able to write.
**Verify.** Count sessions per pipeline run. It equals the number of stages
executed, never fewer.

### DEC-3 — A new role must differ on tools, cost, or context — MUST
Split a role only when at least one holds: it needs **different tool
permissions**; it belongs on a **different cost tier**; it must **not see**
context an existing role has.
**Why.** Those three are the only mechanisms that make a role behave
differently. Job title is not one of them.
**Fails as.** Two roles with identical configuration and different prose,
producing identical output at double the cost.
**Verify.** Tabulate every role's tool list, tier, and fetch list. Two
identical rows are one role.

### DEC-4 — Every role has a named input and a consumed output — MUST
Before a role exists, name the artifact it reads (which must already exist)
and the artifact it writes (which something downstream must already consume).
**Why.** A role with no consumer produces text nobody reads, on a budget
somebody pays.
**Fails as.** A stage everyone skips, still running, still billing.
**Verify.** Point at the code that reads the role's output. If the answer is
"a human might", it is not a pipeline stage.

### DEC-5 — No orchestrator role in the automated pipeline — SHOULD
A role whose job is dispatching other roles belongs in an interactive session,
not in the pipeline.
**Why.** It is DEC-2 by another name: an orchestrator that delegates
in-session collapses the tiering, and one that delegates across sessions is
just the dispatcher you already have.
**Fails as.** Tiering silently gone; capability postures silently uniform.
**Verify.** No role's output is "which role to run next".

---

## CAP — Capability

### CAP-1 — Constraints are enforced by removing capability — MUST
If a role must not do something, remove its ability to do it. Do not instruct
it not to.
**Why.** An agent harness built to produce a change will produce one. A prompt
saying otherwise argues with the environment, and loses.
**Fails as.** The role does the forbidden thing, intermittently, and the
instruction gets rewritten more firmly instead of removed.
**Verify.** For each constraint, ask: *if the model ignored this instruction,
what would stop it?* If the answer is "the instruction", it is not a
constraint.

### CAP-2 — Capability is one semantic knob — MUST
Callers declare intent (`read-only` / `write`). They never pass the runtime's
tool flags.
**Why.** Runtimes disagree about the direction of their tool policy. Pushing
flags through the abstraction pushes that disagreement to every caller.
**Fails as.** See CAP-3.
**Verify.** Grep your dispatch layer for the runtime's tool-flag syntax. It
should appear in exactly one file.

### CAP-3 — Translate intent per runtime, in one place — MUST
Some runtimes are **subtractive** (start able; a deny-list removes). Some are
**additive** (start unable; an allow-list grants). Encode both translations
side by side in the single file that owns them.
**Why.** "Deny nothing but delegation" means *you may write* to a subtractive
runtime and *you may do nothing at all* to an additive one.
**Fails as.** The session runs, produces nothing, and is indistinguishable
from a model that underperformed. You will tune a prompt that was never the
problem.
**Verify.** Run a `write` session on each runtime with a prompt that creates a
file. Assert the file exists. Then run `read-only` and assert it does not.

### CAP-4 — `read-only` is the default — MUST
A caller that specifies no capability gets a session that cannot modify
anything.
**Why.** Failing safe. A forgotten parameter should cost a wasted run, not a
corrupted branch.
**Verify.** Call the session runner with capability omitted; assert it cannot
write.

### CAP-5 — No role may spawn sub-agents — MUST
Delegation capability is removed in **every** posture, including `write`.
**Why.** A role that can spawn has escaped its tool list and its cost tier in
one move. This is DEC-2 enforced rather than assumed.
**Verify.** The delegation tool is absent from both postures in the file
CAP-3 names.

### CAP-6 — Sessions do not publish — SHOULD
A session commits locally; the surrounding automation pushes, comments, and
sets markers.
**Why.** What a session produced should be inspectable before it leaves the
runner. It also keeps credentials out of the session.
**Fails as.** A half-finished session's output already public; a leaked token
in a transcript.
**Verify.** The session's credentials grant no push and no write to the
tracker.

---

## CTX — Context

### CTX-1 — Isolation is enforced by not fetching — MUST
If a role must not be influenced by something, it is absent from its prompt.
An instruction to disregard present context is not isolation.
**Why.** Everything in the window competes. A disregard instruction is one
voice among many, and the thing it forbids is right there.
**Fails as.** A reviewer that agrees with the implementer's reasoning, because
it read it.
**Verify.** Print each role's assembled prompt and read it as the model. Every
forbidden item you find is a field to stop fetching.

### CTX-2 — Prompts declare their fields explicitly — MUST
Enumerate the fields fetched. Never fetch "the whole item".
**Why.** A whole-object fetch silently acquires every field the substrate adds
later. Your isolation guarantee decays with someone else's release notes.
**Verify.** Each assembler names its fields. A wildcard is a finding.

### CTX-3 — A reviewing role never receives the reviewed role's account — MUST
Whatever the producing role wrote *about* its own work — description, summary,
completion report — is absent from the reviewer's prompt.
**Why.** That text was written to be persuasive. A reviewer reading it checks
the account, not the work.
**Fails as.** Reviews that pass shortcuts which came with good explanations.
**Verify.** The reviewer's fetch list does not include the proposal body.

### CTX-4 — An implementing role sees one work item — MUST
Not the parent's task list, not sibling items.
**Why.** An implementer that can see its siblings will helpfully do two of
them, and the diff no longer matches any contract.
**Fails as.** Scope creep that looks like initiative; review becomes a
judgement call.
**Verify.** The assembler fetches one item by ID. Parent context, if any, is
framing text with no task list in it.

### CTX-5 — Resolved questions are not re-presented — SHOULD
A correcting role receives the verdict it is answering, not the ones already
answered.
**Why.** Re-litigation. The role spends its budget defending or reversing
settled decisions.
**Verify.** The fix prompt contains one verdict.

---

## HND — Handoff

### HND-1 — Every stage boundary is a durable artifact — MUST
An artifact qualifies only if it **survives the session**, is **addressable by
ID**, and is **readable by a human who wants to intervene**.
**Why.** It is what makes a stage retryable, auditable, and interruptible.
**Fails as.** A pipeline that cannot be resumed, only restarted.
**Verify.** Kill any session mid-run. The next stage must still be runnable
from what is already written down.

### HND-2 — The work item is the whole contract — MUST
Anything an executing role needs is in the item it is given. Not in the plan
comment, not in the parent, not in a conversation.
**Why.** The executing session never sees the planning session.
**Fails as.** Tasks that only make sense to whoever planned them; execution
that guesses.
**Verify.** The cold-start test, HND-3.

### HND-3 — Work items pass the cold-start test — MUST
Someone who has read **only this item** could do the work and know when they
were done.
**Why.** That is precisely the situation the executing session is in.
**Fails as.** Acceptance criteria reading "works correctly"; an expected-files
list missing the file the change lives in.
**Verify.** Hand an item to a person who has read nothing else. Ask what they
would build and how they would know they were finished.

### HND-4 — Planning output is structured and validated before it materializes — MUST
The planner emits structured data. The publisher validates it, and a plan that
would create unexecutable items creates **none**, loudly.
**Why.** Partial creation leaves a backlog someone cleans up by hand, and the
bad items look exactly like the good ones.
**Fails as.** Permanently blocked items with dangling dependencies; empty
acceptance criteria discovered weeks later.
**Verify.** Minimum checks: non-empty acceptance criteria; every dependency
resolves within the plan; no cycles; scope and out-of-scope present; a sane
item count. Feed the validator a plan failing each, one at a time.

### HND-5 — Parent context does not expand scope — MUST
Where a parent item is visible for framing, it is explicitly not authorization.
**Why.** Otherwise HND-2 is advisory.
**Verify.** The review stage rejects diffs justified only by the parent.

### HND-6 — The contract names no tool — MUST
A work item states objective, scope, expected files, constraints, acceptance
criteria, out-of-scope, dependencies. It does not name the agent, the command,
or the runtime that will execute it.
**Why.** Tool-neutral contracts can be executed by a different vendor, a
different tier, or a person. That substitutability is most of the value.
**Fails as.** A backlog that only one product can run.
**Verify.** Pick three items at random. Could a person execute them with no
agent at all?

---

## DSP — Dispatch and state

### DSP-1 — Work starts because a marker was set — MUST
A stage is triggered by a small, mutable attribute on a work item — not by a
command line, a chat message, or a bespoke UI.
**Why.** Markers are settable from every client, including ones with no agent
controls. Dispatch stays possible from a phone, and stays possible when your
tooling is down.
**Fails as.** A pipeline only its author can operate, from one machine.
**Verify.** Dispatch every stage from a mobile client, using nothing but the
tracker's own UI.

### DSP-2 — Trigger markers are consumed — MUST
The stage removes the marker that started it.
**Why.** Re-setting it is then a clean retry with no separate verb, and no
stage can fire on its own output.
**Fails as.** Ambiguity about whether a re-run happened; dispatch loops.
**Verify.** Set a trigger twice; get two runs. Confirm the removal does not
itself trigger anything.

### DSP-3 — State markers are never consumed — MUST
A marker that answers "what is true of this item" persists until it stops
being true.
**Why.** It is the queryable state. Consuming it destroys the thing it was for.
**Verify.** Each marker is classified **trigger**, **state**, or **button**.
Any marker serving two purposes is documented as such, with its retry story
stated (see DSP-4).

### DSP-4 — A dual-purpose marker states its retry story — SHOULD
Where one marker is both trigger and state, re-setting an already-present
marker is not an event, so re-labelling cannot retry it. Provide a manual
dispatch with a full-sweep option.
**Verify.** Try to retry it by re-setting. Confirm the documented alternative
works.

### DSP-5 — Mutually exclusive states are exclusive by construction — MUST
Where two states cannot both be true (awaiting-planning and planned), the
transition sets one and clears the other atomically enough that no query sees
both.
**Why.** It is what makes a query an exact queue rather than an approximate
one.
**Fails as.** Dashboards that hedge; items in two buckets.
**Verify.** Query for both. The result is empty.

### DSP-6 — Routing is encoded in the marker, not in a separate config — SHOULD
Where a stage can run more than one way — different runtime, different payer —
that choice is a segment of the marker's own name.
**Why.** Changing who answers or who pays becomes a one-tap operation instead
of a code change.
**Verify.** Switch a role's runtime without editing a file.

### DSP-7 — No stage fires on its own output — MUST
**Why.** It loops, and it loops at whatever a session costs.
**Fails as.** A bill.
**Verify.** For each stage, list every write it makes and every trigger it
subscribes to. The sets are disjoint. Check this whenever either changes.

### DSP-8 — Markers are created before the pipeline is believed to work — MUST
Provide an idempotent bootstrap that creates the entire vocabulary, and run it
first.
**Why.** Triggers key on a **name**. On a substrate where none exist, every
stage is inert — with no error, no log, and nothing to find.
**Fails as.** Total silence, mistaken for "not triggered yet", for as long as
it takes someone to guess.
**Verify.** Delete the vocabulary, re-run bootstrap, confirm operability. The
bootstrap never deletes.

### DSP-9 — Marker writes add; they do not replace — MUST
Where the substrate's write operation replaces the whole set, read the current
set first and merge.
**Why.** A replacing write silently drops every other marker on the item.
**Fails as.** Dependency and tier markers vanishing when a verdict is
published. Nothing errors.
**Verify.** Set three markers; have a stage write a fourth; assert four remain.

### DSP-10 — Gates read marker state live — MUST
A check that gates on a marker queries it at run time, never from a replayed
event payload.
**Why.** Re-running a job commonly replays the original payload. A marker
added *after* a failure is invisible to the re-run that was supposed to
observe it.
**Fails as.** A human approves an exception, re-runs, and it fails
identically.
**Verify.** Fail a gate, add the override, re-run. It must pass. The gate's
own failure message must state this procedure.

---

## SES — Session execution

### SES-1 — Runtime differences live in exactly one component — MUST
Everything above the session runner is runtime-blind.
**Why.** It is the seam that makes substitution cheap and keeps one role's bug
in one place.
**Fails as.** A conditional on runtime identity appearing in a second file,
then a third.
**Verify.** Grep for runtime names outside that component. Marker-name strings
and defaults are permitted; behavioural branches are not.

### SES-2 — A runtime identity resolves to independent facts — SHOULD
"Which runtime" and "which credential/payer" are separate. Resolve once; let
nothing downstream re-derive the mapping.
**Why.** A role must not change how it behaves because someone changed who
pays for it.
**Verify.** Switching payer alone changes no tool policy, no model, no prompt.

### SES-3 — Prompts are passed by file or stream, never as an argument — MUST
**Why.** Operating systems cap the size of a single argument well below the
total. A prompt carrying a diff exceeds it.
**Fails as.** An abrupt, unhelpful failure at a size threshold, on exactly the
changes large enough to matter.
**Verify.** Run a session with a prompt larger than your platform's
single-argument limit.

### SES-4 — Prompts are built outside the working tree — MUST
**Why.** A prompt file in the tree gets committed by a `write` session.
**Verify.** After a `write` session, the diff contains no prompt file.

### SES-5 — Model selection is a preference list, walked in order — SHOULD
**Why.** Availability varies by identity and by hour. A single hard-coded
model turns a transient outage into a failed stage.
**Verify.** Put an unavailable entry first; the run succeeds on the next.

### SES-6 — The list advances only on unavailability — MUST
Never on a genuine failure.
**Why.** Retrying a real failure more cheaply defeats whatever tier the caller
chose, invisibly.
**Fails as.** Work deliberately tiered up, done cheaply, passing review.
**Verify.** Force a non-availability failure; assert the list does not advance.

### SES-7 — Fallback escalates; it never cheapens — MUST
Including where the substrate offers only one chain for a whole session.
**Why.** A shared chain that descends hands cheap models the work that was
tiered up. A review done cheaply because the strong model was busy costs a fix
cycle, which is not cheaper.
**Verify.** Every chain is non-decreasing in capability.

### SES-8 — Work items carry a tier, never a model identifier — MUST
**Why.** Items outlive vendor catalogues. A tier is a statement about the
work, which stays true; an identifier is a statement about a catalogue on the
day it was written.
**Fails as.** A backlog referencing retired models.
**Verify.** No model identifier appears on any work item. Tier resolves to
identifier in one configurable place.

### SES-9 — The tier is set by the role that can judge it — SHOULD
The planner sets each task's tier, because it alone sees the whole scope and
reads the code before it is written.
**Why.** The allocation decision needs the most context and the most capable
model. It is already running.
**Verify.** Tier is set at plan time, with written reasoning, and the
automation reads the marker rather than the prose.

### SES-10 — Budget caps are set per role, per runtime, from observation — MUST
Runtimes meter differently. There is no conversion between units.
**Why.** A cap tuned by watching one runtime is not tuned at all on another.
Changing a role's runtime silently reprices it.
**Fails as.** Truncation, on the runtime nobody tuned.
**Verify.** Each role has an explicit cap for each runtime it may use.

---

## OUT — Outcome and verdict

### OUT-1 — Every session is classified into one vocabulary — MUST
One small closed set, one schema, regardless of which runtime answered.
**Why.** Callers branch on it. It is the contract.
**Fails as.** Workflows branching on runtime identity again — the duplication
SES-1 exists to remove.
**Verify.** Diff the classifiers' output keys. Identical.

### OUT-2 — Unavailable fields are zeroed, not omitted — MUST
**Why.** A consumer reading a field must not get a null because the runtime
changed.
**Verify.** Parse each runtime's output with the same consumer.

### OUT-3 — Classification reads harness evidence only — MUST
Exit status, error stream, and the envelope's own error fields. **Never the
model's answer.**
**Why.** The answer is model-authored. A session that merely *discusses* rate
limiting would be classified as rate-limited. Some runtimes also write harness
failures into the same field the model writes to, so it is doubly untrustworthy.
**Fails as.** Confident misclassification; retries of things that succeeded.
**Verify.** Feed the classifier a successful session whose answer discusses
every failure mode by name. It must classify `completed`.

### OUT-4 — Hitting a ceiling is not completion — MUST
A session that exhausted its budget is classified as such.
**Why.** Otherwise a truncated answer is indistinguishable from a finished one.
**Verify.** Force exhaustion; assert the classification.

### OUT-5 — A truncated session never publishes a verdict — MUST
The extractor gates on the session's outcome **before** honouring any verdict
it finds.
**Why.** The verdict line comes first, so it survives truncation. A review cut
off halfway through its criteria table still says it passed.
**Fails as.** The review stage becomes theatre, and stays that way silently.
**Verify.** Feed the extractor a truncated review whose first line is a pass.
It must publish a failure.

### OUT-6 — Verdicts distinguish where the fault lies — MUST
At minimum: **accepted**; **the work is wrong**; **the contract was wrong**;
**a human must decide**.
**Why.** They route to different places. Collapsing to pass/fail sends
contract failures to the correction loop, where they burn every escalation
round and produce nothing.
**Fails as.** Three fix rounds on an item that was unbuildable as written.
**Verify.** Each verdict value routes somewhere different. "Contract was
wrong" never reaches the fixer.

### OUT-7 — Structural completeness is required — SHOULD
A verdict missing the sections the role was asked for did not do the work,
however it ended.
**Verify.** Feed a well-formed verdict line with no body; it must be rejected.

### OUT-8 — Vocabularies do not cross — MUST
A session prompted for one kind of verdict and answering with another fails
loudly.
**Why.** Otherwise it publishes the wrong state.
**Verify.** Cross-feed the extractors.

### OUT-9 — Human-facing reports use the final message — SHOULD
Keep the full transcript separately.
**Why.** A session that narrates while it works puts every aside into the
joined text, and they land verbatim in the published artifact.
**Verify.** Run a narrating session; the published report contains only its
conclusion.

### OUT-10 — Cost is recorded on every path — MUST
Including total failure.
**Why.** You need it most on the runs that failed.
**Verify.** Force a failure with no model output; assert duration and cost are
still numbers.

---

## GAT — Quality gates

### GAT-1 — A new test must have failed against the pre-change code — SHOULD
**Why.** A test that passes before the change verifies nothing the code did
not already do.
**Fails as.** Impressive coverage, zero new verification.
**Verify.** Run the in-scope tests against the merge base; they must be red.

### GAT-2 — Test and assertion counts may not fall — SHOULD
**Why.** Deleting the failing test is always the cheapest path to green, and
nobody sees it in a large diff.
**Verify.** Count before and after; strip comments first, since a commented-out
assertion is a removed one.

### GAT-3 — Measure at the finest unit your harness reports honestly — MUST
Do not claim a granularity your tooling cannot produce a machine-readable
result for. Report finer detail as information; never as a verdict.
**Why.** A verdict you cannot compute is a verdict that will be approximated,
then trusted.
**Verify.** Point at the machine-readable signal each verdict is derived from.

### GAT-4 — "Wrong" and "could not decide" are different outcomes — MUST
A gate that failed to reach a verdict is distinct from one that reached a
negative verdict, and only the latter is overridable.
**Why.** Blurring them means a broken gate looks like an approved exception.
**Fails as.** A gate that has been silently failing open for months.
**Verify.** Distinct exit states. No override path clears the undecidable one.

### GAT-5 — Every gate has a human override with a recorded reason — MUST
**Why.** Every gate has a legitimate exception. A gate without an escape hatch
gets disabled entirely the first time it blocks real work.
**Verify.** The override exists, requires a human, and records why. See DSP-10
for how it must be read.

### GAT-6 — A gate states its own override procedure when it fails — SHOULD
**Why.** Nobody remembers the sequencing, particularly "set the marker, then
re-run".
**Verify.** Read the failure output. It tells you what to do.

### GAT-7 — Gates run on least privilege and write no state — SHOULD
Report to the run's own output, not back to the tracker.
**Why.** It is what lets gates run on contributions from outside your trust
boundary.
**Verify.** The gate's credentials are read-only.

### GAT-8 — Gates are runnable without the automation — MUST
**Why.** A gate you cannot run locally is a gate you cannot test, and
therefore cannot trust.
**Verify.** Run each one from a shell against a local checkout.

### GAT-9 — Deterministic tooling runs before any model — MUST
Where a deterministic tool can do part of the job, it runs first and
unconditionally. Only its residue reaches a session, scoped to that residue.
**Why.** Never spend a model on work a tool does correctly and for free.
**Verify.** The session's input is the tool's own findings list, not the whole
file set.

### GAT-10 — Readiness is asserted by validation, not by a session's report — MUST
A change is marked ready only after its validation actually passed. A change
that fails validation carries an explicit marker saying so.
**Why.** Otherwise "finished and broken" is indistinguishable from "still
working".
**Fails as.** A branch filed under *in progress* forever.
**Verify.** Break a build; assert the marker appears and readiness does not.

### GAT-11 — Know whether the baseline is already broken — SHOULD
Run the full suite against the integration branch on a schedule, independently.
**Why.** Without it you cannot distinguish "this change broke it" from "it has
been broken since Tuesday", and you will spend correction rounds on neither.
**Verify.** A scheduled run exists and its result is visible to the gates.

---

## OBS — Observability

### OBS-1 — Control-plane state is derived, never stored — MUST
Every status shown is computed from the substrate's own graph at render time.
**Why.** Stored status is a second source of truth, and any failed write
leaves it wrong while looking right.
**Fails as.** A board everyone stops believing, then stops updating.
**Verify.** Delete the rendered output. Re-render. Identical.

### OBS-2 — The rendering is reproducible outside the automation — MUST
**Why.** Same reason as GAT-8: untestable otherwise.
**Verify.** Run the renderer locally; get the same states.

### OBS-3 — A failed render leaves staleness, never falsehood — MUST
**Why.** It is what makes on-demand rendering safe: the worst outcome is
showing you yesterday.
**Verify.** Kill a render mid-run. The output is old, not wrong, and says when
it was made.

### OBS-4 — Refresh requests are cleared unconditionally — SHOULD
Including on failure, and sweeping every pending request rather than the one
that fired.
**Why.** A stale board with the request still pending is a dead end — you
cannot ask again without clearing by hand.
**Verify.** Fail a render; assert the request is cleared.

### OBS-5 — Derivation order is explicit and tested — MUST
Where conditions overlap, the precedence is written down and has a test.
**Why.** "Finished and broken" must outrank "in progress", or it hides
forever. This is the ordering GAT-10's marker exists to serve.
**Verify.** Construct an item matching several conditions; assert the bucket.

### OBS-6 — Record what each session cost and how it ended — SHOULD
Role, tier, runtime, model, outcome, duration, cost.
**Why.** Without it you cannot distinguish a tier that is too cheap from a
work item that was badly written, and those have opposite fixes.
**Verify.** Answer, from data: which role fails most, and at which tier?

### OBS-7 — The pipeline's own logic is tested — SHOULD
Dispatch conditions, classification, derivation, and validation are code, and
get tests.
**Why.** They are the parts that fail silently.
**Verify.** A test suite exists that runs without the substrate.

---

## HUM — Human authority

### HUM-1 — Spending a model on a new decision requires a human act — MUST
Narrow, bounded, deterministic-residue work may be exempt; state each
exemption and its bound.
**Why.** It is the cost ceiling and the safety boundary at once.
**Fails as.** Recursive dispatch; a bill.
**Verify.** List every path that starts a session without a human act. Each
has a written bound.

### HUM-2 — Some verdicts are not automatable — MUST
"The contract was wrong" returns to planning. "A human must decide" stops.
Enforce this in the dispatcher, not in prose.
**Why.** Both describe a missing decision. No amount of model will supply it.
**Verify.** Attempt to dispatch a correction against each; it is refused.

### HUM-3 — Correction attempts are capped — MUST
After a small number of rounds on the same change, stop and escalate to a
person.
**Why.** By round three the cause is usually an underspecified item or a wrong
design, and neither is fixed by a better model trying harder.
**Fails as.** An expensive loop that converges on nothing.
**Verify.** The cap exists, and escalation is a defined action rather than
giving up.

### HUM-4 — Work no automated identity can perform is identified before dispatch — MUST
Changes to the pipeline's own configuration, anything needing a credential a
machine does not hold, anything touching formats an automated path handles
badly.
**Why.** Otherwise the dispatch instruction is wrong for exactly the items
where being wrong is most expensive.
**Verify.** Derive the flag from the item's declared scope. A flag a human must
remember to set is a flag that will be missing.

### HUM-5 — Every stage boundary is interruptible — MUST
A human can read the artifact, change their mind, and redirect, at every
boundary.
**Why.** It is the reason the boundaries are where they are.
**Verify.** Stop the pipeline at each boundary. The state is legible and the
next step is a deliberate act.

### HUM-6 — Deviations are recorded, not just taken — SHOULD
When you violate a rule here, write down which and why, next to the thing that
violates it.
**Why.** The next person needs to know whether it was a decision or an
accident. Most of these rules exist because somebody could not tell.
**Verify.** Each known deviation has a note within reading distance of the
code.

---

## Conformance

Levels, and how to self-assess, are in
[`docs/architecture/04-conformance.md`](docs/architecture/04-conformance.md).

A short version: **DEC-1, DEC-2, CAP-1, CTX-1, HND-1 and HND-3 are the load
bearing six.** A system that holds those is recognisably this architecture
even if it holds nothing else. A system that breaks any of them is a different
architecture, and will fail in the ways these rules were written to prevent.
