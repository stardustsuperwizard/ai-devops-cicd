# Session outcomes and verdict protocols

Two contracts hold the pipeline together once sessions start running: **how a
session ended** and **what a reviewing session decided**. Both are classified
by code, never inferred by a human reading a log.

## Part 1 — the outcome vocabulary

Every agent session, from every vendor, is classified into the same small set,
written to the same JSON schema.

```
harness_error        the CLI itself failed — install, flags, transport
model_unavailable    the requested model is not reachable for this identity
budget_exhausted     the session hit its credit or turn ceiling
rate_limited         throttled
session_error        the session ran and failed inside itself
no_assistant_output  the session produced nothing usable
completed            the session finished on its own terms
```

Callers branch on these strings. **They are the contract.** Add to the
vocabulary rarely, and never change what an existing value means.

### Precedence matters

Classify in that order. A session that was rate-limited *and* produced no
output is `rate_limited` — the more specific cause first, because the
guidance printed to a human differs.

### One schema per vendor, enforced

Two vendors emit completely different evidence: one a JSONL event stream, the
other a single JSON envelope. The classifiers must still write the same keys.

Where a vendor cannot supply a field, **zero it rather than dropping it.** A
caller that prints `.event_counts` must not get `null` because the vendor
changed. The moment the schemas diverge, the workflows start branching on
vendor again — which is the duplication the shared abstraction exists to
remove.

### Classify from harness text only — never from model output

This is the one that will bite you.

Detect against the **exit status, stderr, and the envelope's own error
fields**. Never against the model's answer.

The model's answer is model-authored. Match "rate limit" against it and a
session that merely *discusses* rate limiting gets classified as
`rate_limited`. Worse, some harnesses put in-run failure messages into the
same result field the model writes to — so the field is a mix of authored and
harness text, and cannot be trusted for classification at all.

### Make the classifier tell the human what to do

An authentication failure should name **which secret** to set — and that
differs by vendor even when the CLI is the same binary. Guidance that names
the wrong secret sends the reader to fix something that was never broken.

So the classifier is told the caller's vendor and auth mode as *inputs*; it
does not try to read them out of the envelope.

## Part 2 — the verdict protocol

A reviewing session ends with a structured verdict, extracted by code.

| Mode | Vocabulary |
| --- | --- |
| Proposal review | `PASS` / `FIX` / `PLANNING FAILURE` / `DESIGN AMBIGUITY` |
| Plan review | `PLAN PASS` / `PLAN FIX` / `PLAN REJECT` |

Four values, not two, because the three non-pass verdicts route to
**different humans and different next actions**:

| Verdict | Means | Next |
| --- | --- | --- |
| `PASS` | Meets the acceptance criteria | Merge |
| `FIX` | The diff is wrong, the contract was right | Dispatch the fixer |
| `PLANNING FAILURE` | The task item was unexecutable as written | Back to the planner — **a fixer cannot help** |
| `DESIGN AMBIGUITY` | The contract is underspecified in a way needing a decision | **A human decides.** No agent should resolve this |

Collapsing these into "pass/fail" is the single most expensive simplification
available, because it sends planning failures to the fixer, where they consume
three escalating rounds and produce nothing.

### Refuse to publish a truncated verdict

The verdict line comes first, which makes truncation the **dangerous** case
rather than the obvious one:

> A review cut off halfway through its acceptance-criteria table still says
> `VERDICT: PASS` at the top.

So the extractor gates on the session's **outcome** before honouring the
verdict line. A session classified `budget_exhausted`, `no_assistant_output`
or `session_error` does not get to publish a verdict, however well-formed its
first line looks. It publishes a failure instead.

This is why parts 1 and 2 live in the same document: the verdict extractor is
the outcome vocabulary's most important consumer.

### Also gate on structural completeness

Require the sections the role's profile asked for. A verdict with no
acceptance-criteria table did not do the review, regardless of how it ended.

### Do not accept the wrong vocabulary

A plan verdict is not accepted in proposal-review mode, and vice versa. A
session prompted for one and answering with the other should fail **loudly**
rather than publish the wrong marker.

## Part 3 — the report the human reads

Distinguish two outputs from every session:

| Output | Contents |
| --- | --- |
| **Joined assistant text** | Everything the session said |
| **Final message only** | The session's last message — its completion report |

Prefer the **final message** anywhere the text is rendered to a human as the
session's report. A session that narrates while it works ("Now the doc.") puts
every one of those lines into the joined file, and they end up in the change
proposal's description verbatim.

Fall back to the joined text when no single final message can be isolated, so
the final-message output is never empty where the joined one would not be.
Keep both outputs distinct even for a vendor where they are identical: which
one a caller wants is a property of the caller, not of whoever happens to be
answering today.

## Part 4 — always report the cost

Record the session's duration and cost on **every** path — the success path,
the path where no model produced output, and a run that failed inside the
walk. Measure it in a step that runs unconditionally.

A caller recording what a session cost needs that number most on the runs that
failed.
