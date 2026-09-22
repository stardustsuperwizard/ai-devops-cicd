# Seam catalogue

Every place the reference implementation touches its platform. For each:

| | |
| --- | --- |
| **Does** | What the reference actually does — a line you can open |
| **Means** | What it is doing *abstractly*. Translate this, never the syntax |
| **Ask** | The question to put to your own tools |
| **The tell** | What you observe if your substitute is wrong. Usually not an error |

Seams marked **may not apply** are scar tissue for platform-specific
behaviour. If your platform does not have the problem, dropping the seam is
correct — and is a deviation worth recording, so the next person knows where
it went.

Reference: [`../../templates/github-actions/`](../../templates/github-actions/).
Rules: [`../../RULES.md`](../../RULES.md).

---

# A — Dispatch

## S-A1 — The trigger

**Does.** A workflow fires on a label being added to an issue or pull request
(`on: issues: [labeled]`), and reads `github.event.label.name`.

**Means.** A human sets a small named attribute on a work item, and something
observes it. The *name* carries the routing.

**Ask.**
- What attribute can a **non-admin** set from a **mobile client** in two taps?
- Is it **multi-valued**? Several must coexist on one item: blocked, a tier,
  a trigger.
- Can automation observe a change to it, or must you poll?

**The tell.** If you picked a single-valued field (a status), you will find
out when an item needs to be both blocked and awaiting review, and you start
inventing compound states. The state count then grows as the product of the
things you are tracking. If you picked something needing admin rights, the
vocabulary stops evolving and people work around it.

> **This is the decision the engineer makes, not the agent.** It depends on
> facts about your organisation that are in no repository.

→ [DSP-1](../../RULES.md#dsp-1--work-starts-because-a-marker-was-set--must)
· [substrate: choosing a marker primitive](../architecture/02-substrate.md#choosing-a-marker-primitive)

## S-A2 — Routing inside the name

**Does.** `agent:{role}:{vendor}` — the workflow reads the third segment and
passes it to the session runner.

**Means.** Which role runs, and **which account pays**, are both chosen by
setting one attribute. Changing the payer is a tap, not a commit.

**Ask.** Does your attribute allow structured names (separators, no spaces,
length)? If not, where does routing live instead — and is *that* settable
without a code change?

**The tell.** Routing that lives in a config file means switching vendor is a
pull request. Workable, and you have lost the property.

→ [DSP-6](../../RULES.md#dsp-6--routing-is-encoded-in-the-marker-not-in-a-separate-config--should)

## S-A3 — Consuming the trigger

**Does.** The last step removes the label it fired on, under `if: always()`.

**Means.** Re-setting the attribute is a clean retry with no separate verb,
and no stage can fire on its own output. `always()` means a *failed* run is
retryable too.

**Ask.** Can you clear one attribute without rewriting the whole set? Many
APIs only offer "set the collection".

**The tell.** If your API replaces rather than adds, a naive implementation
**silently drops every other marker** on the item — the tier, the blocked
state, the verdict. Nothing errors. You find out when the dashboard starts
disagreeing with reality.

→ [DSP-2](../../RULES.md#dsp-2--trigger-markers-are-consumed--must),
[DSP-9](../../RULES.md#dsp-9--marker-writes-add-they-do-not-replace--must)

## S-A4 — Loop safety

**Does.** Every workflow's trigger set is disjoint from the set of things it
writes. The reference checks this by hand; nothing enforces it.

**Means.** No stage fires on its own output.

**Ask.** What does your automation fire on, and what does each stage write?
Enumerate both. Intersect them.

**The tell.** A bill. This is the single most expensive mistake available
here, and it is invisible until the invoice — a loop that costs a session per
iteration can run for hours before anyone notices.

Re-check whenever either set changes.

→ [DSP-7](../../RULES.md#dsp-7--no-stage-fires-on-its-own-output--must)

## S-A5 — Concurrency

**Does.** `concurrency: group: agent-review-${{ pr number }}` with
`cancel-in-progress` — true for most roles, **false** for the rollup.

**Means.** One session per item at a time. Where a later run supersedes an
earlier one, cancel; where each run does distinct work, queue.

**Ask.** Can you serialize by a key derived from the item? What happens to the
second run — queued, rejected, or run anyway?

**The tell.** Two implementers on one item produce two branches, and the
second overwrites the first's push. Rare, confusing, and expensive.

## S-A6 — Manual dispatch — *may not apply*

**Does.** Every workflow also has `workflow_dispatch` with the inputs the
event would have carried (item number, vendor).

**Means.** An escape hatch that does not depend on the event system working.

**Ask.** Can you invoke a job by hand with parameters?

**The tell.** Without it, a failed event is unrecoverable except by re-setting
a marker — which does not work for the dual-purpose ones (S-C5).

---

# B — Identity and permission

## S-B1 — Per-role least privilege

**Does.** Each workflow declares narrow `permissions:` — the planner gets
`issues: write` and `contents: read`; only the implementer and fixer get
`contents: write`.

**Means.** Capability removal, enforced at the credential rather than the tool
list.

**Ask.** Can you scope credentials **per job**? If only per-project, what is
the least that satisfies the union — and which rules does that union break?

**The tell.** A read-only role holding write scope means the tool-list
restriction is the only thing stopping it, which is CAP-1 defeated one level
down. You will not notice, because the role has no reason to try.

→ [SEC-1](../../RULES.md#sec-1--pipeline-credentials-hold-the-narrowest-scope-that-works--must)

## S-B2 — What the automation identity cannot do

**Does.** `task_scope.py` refuses before paying for a session when an item's
declared scope touches `.github/workflows/` or `.github/actions/` — GitHub's
default token cannot push those, deliberately, and no permission lifts it.

**Means.** Every platform forbids its automation something — usually
modifying its own configuration. Detect it **at plan time**, from the item's
declared scope.

**Ask.** What is your automation identity forbidden? Try it and read the
error, rather than trusting documentation.

**The tell.** Without the check the failure lands at the **push** — after a
full session has been paid for and produced complete, correct work — and is
diagnosable only by reading a run log. In the source system, one epic's
decomposition hit this three times before the check existed.

→ [SEC-2](../../RULES.md#sec-2--work-an-automated-identity-cannot-perform-is-known-at-plan-time--must),
[HUM-4](../../RULES.md#hum-4--work-no-automated-identity-can-perform-is-identified-before-dispatch--must)

## S-B3 — Credentials by vendor

**Does.** `run-agent-session` takes `api-key` and `oauth-token` as separate
inputs, reads only the one its vendor needs, and names *that* one in a failure
message.

**Means.** Guidance that names the wrong credential sends a reader to fix
something that was never broken.

**Ask.** How are secrets scoped, and can a composite/shared step read them
directly? (In the reference it cannot — they must be threaded through every
caller, and a secret set on the repository but not passed never arrives.)

**The tell.** An authentication failure that names the credential you did not
configure, while the one you did is fine.

## S-B4 — The session holds no publishing credential

**Does.** The agent commits locally. The workflow pushes, comments, and sets
markers.

**Means.** What a session produced is inspectable before it leaves, and a
credential is never inside a transcript.

**Ask.** Can you run the agent with no push credential in its environment?

**The tell.** A half-finished session's output is already public. Or worse, a
token in a log.

→ [SEC-3](../../RULES.md#sec-3--an-agent-session-never-holds-a-publishing-credential--must)

---

# C — Work items

## S-C1 — Reading an item

**Does.** `gh issue view N --json number,title,body`.

**Means.** Fetch an item's text by ID. Trivial everywhere.

**Ask.** The API, and its rate limits. This is called dozens of times per run.

## S-C2 — The fetch list — **the one to get right**

**Does.** `gh pr view N --json number,title,headRefName,files,additions,deletions`
— with `body` **conspicuously absent**, and a comment saying why.

**Means.** Context isolation. The reviewer does not receive the implementer's
account of its own work, because that account was written to be persuasive.
Enforced by **not fetching**, never by an instruction to disregard.

**Ask.** Does your API let you request specific fields? **If it only returns
whole objects, you must strip explicitly, and that strip is now load-bearing
code** — name it, comment it, and test it.

**The tell.** The port works. Reviews pass. Nothing indicates that the
reviewer is agreeing with the author's reasoning rather than checking the
diff, and you will read a quarter's worth of reviews before you notice they
are all a little too agreeable.

This is the seam most likely to be translated as "fetch the pull request" and
silently lost.

→ [CTX-1](../../RULES.md#ctx-1--isolation-is-enforced-by-not-fetching--must),
[CTX-3](../../RULES.md#ctx-3--a-reviewing-role-never-receives-the-reviewed-roles-account--must)

## S-C3 — Writing a marker

**Does.** `gh issue edit N --add-label X` / `--remove-label X`.

**Means.** Add to a set, do not replace it.

**Ask.** Does your write **add** or **replace**? Check, do not assume — the
reference's own MCP surface replaces where its CLI adds, and the two are
otherwise interchangeable.

**The tell.** See S-A3. Silent loss of every other marker, no error.

## S-C4 — Hierarchy

**Does.** `sub_issue` API for parent ↔ child.

**Means.** An epic owns tasks; the rollup and the dashboard walk it.

**Ask.** Native parent/child? If not: a field plus a line in the body, tree
derived at render time.

**The tell.** Without it the rollup cannot tell when an epic is complete, and
the dashboard's epic states are guesses.

## S-C5 — Dependencies

**Does.** `--add-blocked-by`, plus a `## Dependencies` table **in the item
body** that `sync-issue-dependencies.py` parses and wires.

**Means.** Two representations on purpose: the body is human-readable and
reviewable; the native link is queryable.

**Ask.** Do you have typed dependency links? Are they queryable in your query
language, or must you walk them per item?

**The tell.** No dependency ordering means items get dispatched before their
blockers land, and the implementer builds against code that does not exist
yet — producing a plausible diff that cannot work.

**May not apply:** if your links are strong and queryable, the body table is
redundant. Keep it anyway if you want the dependency reviewable in a diff.

## S-C6 — Item ↔ change proposal link

**Does.** Requires `Closes #N` in every proposal body; reads the link back via
`closingIssuesReferences`.

**Means.** The reviewer must fetch the contract the diff is judged against.
Without the link there is nothing to review against.

**Ask.** How does a change proposal reference a work item? A key in the branch
name, a smart-commit convention, an explicit field?

**The tell.** The review stage cannot find the acceptance criteria and either
fails loudly (fine) or reviews the diff on its own merits (not fine — that is
code review, not contract verification, and it will pass work that does not
do what was asked).

## S-C7 — Query as an exact queue

**Does.** `is:issue is:open label:plan` is an *exact* list of items awaiting
planning, because `plan` and `planned` are mutually exclusive by construction.

**Means.** Derived state rather than stored state. The dashboard is one query
per row.

**Ask.** What is your query language, and can it express these? What does it
cost?

**The tell.** If a query is approximate, the dashboard starts hedging — and a
board people do not believe is a board they stop updating.

→ [DSP-5](../../RULES.md#dsp-5--mutually-exclusive-states-are-exclusive-by-construction--must)

## S-C8 — Bootstrapping the vocabulary

**Does.** `bootstrap-labels.sh` creates every marker idempotently, never
deletes, and re-asserts colour and description.

**Means.** Triggers key on a **name**. Until the name exists, every stage is
inert.

**Ask.** How are your attribute values created? Some platforms create on first
use (then your bootstrap is "apply each one once to a scratch item"); some
need an admin API.

**The tell.** **No error, no log, nothing to find.** Every stage silently does
not fire, and the silence reads as "not triggered yet" for as long as it takes
someone to guess. This is the highest-frustration failure in the whole port.

→ [DSP-8](../../RULES.md#dsp-8--markers-are-created-before-the-pipeline-is-believed-to-work--must)

---

# D — Session execution

## S-D1 — Running the agent

**Does.** `npm install -g <cli>`, then run it with a prompt, capturing stdout,
stderr and exit status separately.

**Means.** Execute a program, keep all three channels. The classifier needs
stderr and exit status; the publisher needs stdout.

**Ask.** Can your runner install a CLI, and does it give you all three
channels distinctly? Some capture a single merged stream.

**The tell.** A merged stream forces the classifier to read the model's own
answer for evidence of how the session ended — which is exactly what OUT-3
forbids, and it misclassifies any session that *discusses* a failure mode.

## S-D2 — Passing the prompt

**Does.** By file path or stdin. Never as an argument.

**Means.** Operating systems cap a single argument (~128 KiB on Linux) well
below the total. A prompt carrying a diff exceeds it.

**Ask.** Nothing — this is an OS limit, not a platform one. It applies to you.

**The tell.** An abrupt, unhelpful failure at a size threshold, on exactly the
changes large enough to matter. Small test cases pass.

→ [SES-3](../../RULES.md#ses-3--prompts-are-passed-by-file-or-stream-never-as-an-argument--must)

## S-D3 — Scratch outside the tree

**Does.** Everything in `$RUNNER_TEMP`, never the checkout.

**Means.** A prompt file in the working tree gets committed by a `write`
session.

**Ask.** Where is your per-run temp? Is it writable, and cleaned between runs?

**The tell.** Prompt files and session transcripts in your diffs.

## S-D4 — The capability translation

**Does.** One `capability: read-only | write` input, translated per vendor in
one `case` — `--excluded-tools` for the subtractive runtime,
`--permission-mode dontAsk --allowedTools` for the additive one.

**Means.** Callers state intent; the runner encodes it. One file owns the
disagreement.

**Ask.** Is each of your runtimes additive or subtractive? **Determine this by
experiment, not documentation.**

**The tell.** The worst tell in the catalogue: the session runs, produces
nothing, and is **indistinguishable from a model that underperformed**. You
will tune a prompt that was never the problem, possibly for days.

→ [CAP-3](../../RULES.md#cap-3--translate-intent-per-runtime-in-one-place--must)

## S-D5 — The model preference list

**Does.** A comma-separated list walked in order, advancing **only** on
unavailability, never after a real failure. Dumps the runtime's own model list
into the log.

**Means.** Availability varies by identity and hour. A real failure retried
more cheaply defeats the tier the caller chose.

**Ask.** How does your runtime report "model unavailable" distinctly from
"the request failed"?

**The tell.** Two, both quiet. A mistyped model ID is skipped and looks
exactly like a fallback that was never needed — hence the log dump. And
advancing on real failures means work deliberately tiered up gets done
cheaply and passes review.

→ [SES-6](../../RULES.md#ses-6--the-list-advances-only-on-unavailability--must)

## S-D6 — Budget caps

**Does.** `max-ai-credits` for one vendor, `max-turns` for the other. Both
declared; each ignored by the other.

**Means.** Runtimes meter in different units, and **there is no conversion**.

**Ask.** What does each of your runtimes cap, in what unit?

**The tell.** Changing a role's runtime silently reprices it. A cap tuned by
watching one runtime truncates sessions on the other.

→ [SES-10](../../RULES.md#ses-10--budget-caps-are-set-per-role-per-runtime-from-observation--must)

## S-D7 — Outcome classification

**Does.** One classifier per runtime, one schema, reading **exit status,
stderr, and the envelope's error fields only** — never the model's answer.
Absent fields are zeroed, not dropped.

**Means.** One vocabulary so nothing upstream branches on runtime identity.

**Ask.** What does your runtime emit — an event stream, one envelope, plain
text? Where does it put *its own* errors versus the model's output?

**The tell.** Classify from the answer and a session that merely *discusses*
rate limiting gets classified as rate-limited, then retried. Some runtimes
also write harness failures into the same field the model writes to, making
that field untrustworthy for this purpose entirely.

→ [OUT-3](../../RULES.md#out-3--classification-reads-harness-evidence-only--must)

---

# E — Reporting

## S-E1 — Step outputs

**Does.** `echo "key=value" >> $GITHUB_OUTPUT`, read as `steps.x.outputs.key`.

**Means.** Pass a value from one step to the next without a file everyone
knows about.

**Ask.** Your equivalent. Note the reference deliberately avoids the
environment-wide form, which would leak values into unrelated steps.

**The tell.** A value read by a step that should not have seen it — harmless
until it is a credential.

## S-E2 — Run summaries and annotations

**Does.** `$GITHUB_STEP_SUMMARY` for reports; `::error::` / `::warning::` for
annotations.

**Means.** Gates report to the **run**, not back to the tracker — which is
what lets them run on contributions from outside your trust boundary with a
read-only credential.

**Ask.** Where does your runner surface a report? Is there an annotation
concept, and is it truncated? (The reference encodes an entire report into one
annotation because only the first ten per level survive.)

**The tell.** Push gate results back to the tracker instead and you need a
write credential, which means gates cannot run on untrusted contributions —
exactly where you want them.

→ [GAT-7](../../RULES.md#gat-7--gates-run-on-least-privilege-and-write-no-state--should)

## S-E3 — The published verdict

**Does.** A comment plus a `review:*` marker. The marker is read; the comment
is for humans.

**Means.** Machine-readable state and human-readable reasoning, separately.

**Ask.** Both surfaces exist? Is the comment addressable, for a reply?

**The tell.** Parsing the comment for state instead of using the marker means
a rewording breaks the pipeline.

## S-E4 — Checks against a specific commit — *may not apply*

**Does.** Publishes a check run against an explicit `head-sha`.

**Means.** A job running in an *issue*-triggered run attaches results to that
run's head — the default branch — so the result never appears on the proposal
it is about.

**Ask.** Does your platform attach results to the right commit automatically?

**The tell.** Validation runs, passes, and appears nowhere useful. The
proposal looks unchecked because, as far as anyone can see, it is.

→ [INT-6](../../RULES.md#int-6--verification-runs-on-the-commit-the-agent-actually-pushed--must)

---

# F — Control flow

## F is where most subtle porting bugs live.

## S-F1 — Skipped counts as reported

**Does.** Triggers are unfiltered; jobs gate themselves with `if:`.

**Means.** A workflow skipped by a **path filter** reports *no status at all*.
A job skipped by a **condition** reports "skipped", which counts.

**Ask.** In your system, what does a skipped unit report to the merge gate —
success, nothing, or failure?

**The tell.** Documentation-only proposals hang forever waiting for a check
that will never arrive, and the fix people reach for is making the check not
required — which removes the gate.

→ [INT-2](../../RULES.md#int-2--verification-triggers-are-unfiltered-filtering-lives-in-the-jobs--must)

## S-F2 — The aggregate

**Does.** One `ci` job, `needs:` every verification job, `if: always()`,
failing if any need is not `success` or `skipped`. It is the only required
check.

**Means.** Merge policy names one thing. A list of individual jobs drifts the
moment someone adds one, and the drift is invisible.

**Ask.** Can you express "depends on all of these, run even if they failed,
inspect their results"?

**The tell.** A new job runs, can fail, and merges anyway.

→ [INT-1](../../RULES.md#int-1--one-aggregate-check-is-what-merge-policy-names--must)

## S-F3 — `!cancelled() && !failure()`

**Does.** Used where a job must be sequenced behind another but skip if that
one failed.

**Means.** "Run me only if my precondition actually held." The red gate's
claim is *green on the head, red at the base* — the first half is established
by the validation job, not by believing a session's report.

**Ask.** How do you express conditional sequencing? Does your default treat an
upstream failure as skip, or run-anyway?

**The tell.** A gate that runs when its precondition did not hold produces a
verdict about nothing, confidently.

## S-F4 — Replayed event payloads

**Does.** Gates read labels **live from the API**, never from the event
payload, and the documented procedure is *set the marker, then re-run*.

**Means.** Re-running a job commonly replays the **original** event. A marker
set *after* a failure is invisible to the re-run meant to observe it.

**Ask.** Does your re-run replay the original event or fetch fresh?

**The tell.** A human approves an exception, re-runs, and it fails
identically. They conclude the override is broken and stop using the gate.

→ [DSP-10](../../RULES.md#dsp-10--gates-read-marker-state-live--must)

## S-F5 — Always-run cleanup

**Does.** Trigger consumption and refresh-button clearing run under
`if: always()`.

**Means.** A failed run must still be retryable; a stale board with the button
still pressed is a dead end.

**Ask.** Can a step run regardless of prior failure?

**The tell.** Failed runs are not retryable by the documented route, and
nobody knows the undocumented one.

## S-F6 — Reusable job definitions

**Does.** `project-validation.yml` is `workflow_call`, invoked by CI *and* by
each agent workflow.

**Means.** One definition of "is it green?", three callers. Copies drift, and
the one that drifts is the one the agent trusts.

**Ask.** Can you factor a job and call it with parameters? Composite steps and
callable jobs are usually different mechanisms with different limits.

**The tell.** The implementer reports validated; CI disagrees; nobody can
reproduce either.

→ [INT-4](../../RULES.md#int-4--the-same-validation-runs-locally-in-ci-and-in-the-agent-session--must)

## S-F7 — Two trees at once

**Does.** `git worktree add --detach` into temp, for the ratchet and the red
gate.

**Means.** Compare head against merge base without a second checkout **inside**
the tree.

**Ask.** Does your runner allow a second working tree? Is full history
available, or is the clone shallow? (Both gates need `fetch-depth: 0` — a
shallow clone has no merge base to find.)

**The tell.** A checkout inside the tree gets picked up by test discovery, by
the formatter, and by the agent session's own file walk. Symptoms are
bewildering: doubled test counts, a formatter reformatting a copy of itself.

---

# G — The merge gate

**Build this group first, before any agent runs.** It is conformance level 0.

## S-G1 — Required checks

**Does.** Branch protection requires the `ci` aggregate.

**Means.** Red cannot merge, enforced by the platform.

**Ask.** What is your protection mechanism, who can configure it, and who can
bypass it? **Find out who can bypass.**

**The tell.** If admins bypass silently, the gate is advisory and you will not
know until someone uses it.

→ [MRG-2](../../RULES.md#mrg-2--merge-protection-is-configured-not-conventional--must)

## S-G2 — Human approval

**Does.** Branch protection requires an approving review from a person.

**Means.** **The one thing the pipeline cannot supply.** Everything upstream
is agents judging agents.

**Ask.** Can you require approval, and can you require it from someone other
than the author? Does your platform count a bot's approval?

**The tell.** The worst tell here, because there is no symptom. Everything is
green, throughput is high, and the system is certifying its own output. You
find out from a defect that a person would have caught.

→ [MRG-1](../../RULES.md#mrg-1--a-machine-verdict-is-never-sufficient-to-merge--must)

## S-G3 — The writing identity cannot approve

**Does.** The agents' credential has no approval permission.

**Means.** CAP-1 applied to the merge gate — remove the capability, do not
instruct.

**Ask.** Try it. Have the implementer's credential attempt an approval, and
confirm it fails.

**The tell.** An agent helpfully clears the last obstacle to a green board.
Once it works, it happens every time.

→ [MRG-3](../../RULES.md#mrg-3--the-identity-that-writes-code-cannot-approve-it--must)

## S-G4 — Nothing in the pipeline merges

**Does.** No workflow merges. Auto-merge may be enabled by a human per
proposal.

**Ask.** Can you withhold merge permission from the automation identity while
granting push?

**The tell.** The last reversible point stops being a decision.

---

# H — The toolchain

Four files. **These are the only place your language appears** — and the
reason the other ~22,000 lines port by editing strings.

| Seam | File | Contract |
| --- | --- | --- |
| **S-H1** | `project-validate.sh` | `0` green · `1` not green · `127` toolchain absent. Output captured verbatim and truncated **from the front** — put the summary last |
| **S-H2** | `setup-toolchain/` | After it, the tool is on `PATH`. Cache it; this runs on every session |
| **S-H3** | `format-code/` | `check` never writes; `fix` applies. Outputs `clean` and `formatted`. Diff-scoped, never whole-repo |
| **S-H4** | `suite-log.sh` | Base production code + head test code, suite run, log captured. Exits `0` whenever it **could run** — a red suite is the expected outcome |

**Ask.** For each: what is the command, and does it run non-interactively with
no network and no credentials?

**The tell, S-H1.** Conflating exit `1` and `127` reports a red build when a
setup step was skipped, and sends people to debug a suite that never ran.

**The tell, S-H4.** The exit convention is the one to get right. This script
reports *whether it could run*, never *whether the suite passed* — conflating
them turns "the gate is broken" into "the change is fine", and a gate failing
open is invisible for months.

**The tell, S-H3.** A whole-repo formatter on an existing codebase reformats
thousands of untouched lines and makes the real change unreviewable.

→ [GAT-3](../../RULES.md#gat-3--measure-at-the-finest-unit-your-harness-reports-honestly--must),
[GAT-4](../../RULES.md#gat-4--wrong-and-could-not-decide-are-different-outcomes--must),
[GAT-9](../../RULES.md#gat-9--deterministic-tooling-runs-before-any-model--must)

---

# Working the catalogue

Fill one row per seam:

| Seam | Our equivalent | Applies? | Verified how | Deviation |
| --- | --- | --- | --- | --- |
| S-A1 | | ☐ | | |
| … | | | | |

Three rules for filling it in:

1. **Translate "Means", not "Does".** A seam translated from syntax is a seam
   whose purpose you did not carry.
2. **"Verified how" is a command or an observation.** "Looks equivalent" is
   not verification — see [`05-equivalence-tests.md`](05-equivalence-tests.md).
3. **Record every dropped seam**, including the ones correctly dropped. The
   next person will wonder, and "we checked, our platform does not have that
   problem" is the answer they need.

The highest-risk seams, if you are triaging: **S-C2** (the fetch list),
**S-D4** (additive vs subtractive), **S-C8** (bootstrap silence), **S-F4**
(replayed payloads), and all of **G**.
