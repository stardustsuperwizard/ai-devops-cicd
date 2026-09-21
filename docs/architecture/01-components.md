# Components

Seven components. Each is defined by a **contract** — what it takes, what it
returns, what it may not know — not by an implementation.

Most failures in this architecture are a component knowing something it should
not. The "must not know" column is the load-bearing one.

```
  marker set
      │
      ▼
 ┌──────────────┐   role, runtime, item id
 │ C1 DISPATCH  │─────────────────────────┐
 └──────────────┘                         │
      │ consumes the trigger              ▼
      │                          ┌──────────────────┐
      │                          │ C2 ASSEMBLE      │  fetch list → prompt
      │                          └────────┬─────────┘
      │                                   ▼
      │                          ┌──────────────────┐
      │                          │ C3 RUN SESSION   │  ← the only component
      │                          └────────┬─────────┘    that knows runtimes
      │                                   ▼
      │                          ┌──────────────────┐
      │                          │ C4 CLASSIFY      │  harness evidence → outcome
      │                          └────────┬─────────┘
      │                                   ▼
      │                          ┌──────────────────┐
      └─────────────────────────▶│ C5 PUBLISH       │  → items, markers, artifacts
                                 └────────┬─────────┘
                                          │
                     ┌────────────────────┴───────────────────┐
                     ▼                                        ▼
            ┌──────────────────┐                   ┌──────────────────┐
            │ C6 GATES         │                   │ C7 RENDER        │
            └──────────────────┘                   └──────────────────┘
```

C6 and C7 are not in the request path. Gates run against changes whenever they
appear; the renderer derives state on demand. Neither is allowed to write
anything the others read.

---

## C1 — Dispatch

Turns "a human set a marker" into "a role runs".

| | |
| --- | --- |
| **In** | A marker-set event, or a poll finding a set marker |
| **Out** | A role, a runtime identity, and a work item ID |
| **Also does** | Clears the trigger it consumed |
| **Must not know** | Anything about prompts, models, or what the role does |

**Contract.**

1. The marker's name carries the routing. Where a stage can run more than one
   way — a different runtime, a different payer — that is a segment of the
   name, so changing it is a one-tap operation rather than a code change.
2. One dispatcher per **role**, not per runtime. Three dispatchers for one
   role means three places to fix its bug.
3. It clears the trigger **unconditionally**, including on failure — that is
   what makes re-setting the marker a clean retry with no separate verb.
4. It never subscribes to anything it writes. For every stage, the set of
   things it writes and the set of things it triggers on are disjoint. Check
   this whenever either changes; the failure mode is a loop that bills.

**Where it may fire without a human:** checking work already started (review
on a proposal becoming ready) — a safety net, because gating it lets an
unreviewed proposal sit looking finished. Never for work that starts a new
decision.

---

## C2 — Assemble

Builds one prompt. **This is where context isolation lives.**

| | |
| --- | --- |
| **In** | A role and a work item ID |
| **Out** | A prompt, written to scratch outside the working tree |
| **Must not know** | Which runtime will answer |

**Contract.**

1. **Fields are enumerated explicitly.** Never fetch a whole object: a
   whole-object fetch silently acquires every field the substrate adds later,
   so the isolation guarantee decays with someone else's release notes.
2. **The fetch list is the isolation mechanism.** Not a line in the prompt
   asking the model to disregard something present. Everything in the window
   competes; absence does not.
3. **The output format is specified in the prompt**, precisely enough that C5
   can parse it — including where the machine-readable part must appear.
4. **Scratch, not the tree.** A prompt file in the working tree gets committed
   by a `write` session.
5. **By file or stream, never as an argument.** Operating systems cap a single
   argument well below the total, and a prompt carrying a diff exceeds it —
   failing abruptly, at a size threshold, on exactly the changes large enough
   to matter.

**The per-role fetch lists** — the whole of CTX:

| Role | Fetches | Withholds |
| --- | --- | --- |
| Plan | Intake item; inventory of the existing system | Previously rejected plans for this item |
| Implement | **One** task item; project conventions | The parent's task list; sibling items |
| Review | The changes; the task item; its criteria; validation results | **The producer's account of its own work** |
| Fix | One verdict; the changes; the task item | Already-answered verdicts |

---

## C3 — Run session

**The only component permitted to know that runtimes differ.**

| | |
| --- | --- |
| **In** | Runtime identity; prompt location; model preference list; capability posture; budget cap |
| **Out** | Full transcript; final message; outcome; duration; cost; failure detail |
| **Must not know** | Which role it is serving, or what the answer means |

**Contract.**

1. **Capability is one semantic knob** — `read-only` or `write` — translated
   per runtime inside this component. Callers never pass tool flags.
2. **The translation table is written out per runtime, side by side.** Some
   runtimes are subtractive (start able; a deny-list removes). Some are
   additive (start unable; an allow-list grants). *"Deny nothing but
   delegation"* means **you may write** to one and **you may do nothing at
   all** to the other — and the additive failure is silent, producing a
   session indistinguishable from a model that underperformed.
3. **`read-only` is the default**, because it fails safe.
4. **Delegation is removed in both postures.** A role that can spawn has
   escaped its tool list and its tier in one move.
5. **Runtime identity resolves into independent facts** — *which program runs*
   and *which credential pays* — once, here. Two identities sharing a program
   and differing only in who pays must behave identically in every other
   respect: a role must not change behaviour because someone changed the payer.
6. **The model list is walked in order, advancing only on unavailability.** A
   cheap retry after a genuine failure silently defeats whatever tier the
   caller chose — and work deliberately tiered up gets done cheaply and passes
   review.
7. **Model identifiers are runtime-native and never portable between
   runtimes.** Dump the runtime's own list into the log, so a rejected
   identifier is self-diagnosing rather than a mystery; the failure is
   otherwise quiet, because an unreachable identifier is skipped and looks
   exactly like a fallback that was never needed.
8. **Budget caps are per role per runtime, from observation.** Runtimes meter
   differently and there is no conversion between units, so a cap tuned by
   watching one is not tuned at all on another.
9. **Cost and duration are reported on every path**, including total failure —
   which is when a caller needs them most.
10. **The session does not publish.** It writes locally; C5 pushes. What a
    session produced should be inspectable before it leaves.

---

## C4 — Classify

Decides how a session ended, from harness evidence.

| | |
| --- | --- |
| **In** | Exit status; error stream; the runtime's own envelope |
| **Out** | One outcome value, in one schema, whatever answered |
| **Must not know** | What the session was for |

**Contract.**

1. **One closed vocabulary, one schema**, across every runtime. Callers branch
   on it; it is the contract. The moment two runtimes' schemas diverge,
   everything upstream starts branching on runtime identity again — the
   duplication C3 exists to remove.
2. **Unavailable fields are zeroed, not omitted.** A consumer must not get a
   null because the runtime changed.
3. **Classify from harness evidence only — never from the model's answer.**
   The answer is model-authored, so matching patterns against it classifies a
   session that merely *discusses* a failure mode as having suffered it. Some
   runtimes also write harness failures into the same field the model writes
   to, making it doubly untrustworthy.
4. **Hitting a ceiling is not completion.** Otherwise a truncated answer is
   indistinguishable from a finished one — the precondition C5 depends on.
5. **Guidance names the specific remedy**, including which credential to set —
   which differs by payer even on the same program. Guidance naming the wrong
   one sends a reader to fix something that was never broken. So the caller's
   configuration is an **input**, not something inferred from the envelope.

---

## C5 — Publish

Turns a session's text into structure, and writes it back.

| | |
| --- | --- |
| **In** | Session text; outcome; the work item |
| **Out** | Work items, markers, artifacts |
| **Must not know** | Which runtime answered |

**Contract.**

1. **Parse before writing.** Nothing is written from a session whose output
   did not parse.
2. **Gate on the outcome before honouring the content.** A session that did
   not finish does not publish, however well-formed its output looks. This
   matters most where the machine-readable verdict comes *first* — a review
   cut off halfway through its criteria table still says it passed, and
   publishing that makes the review stage theatre, silently.
3. **Require the structure the role was asked for.** Output missing its
   required sections did not do the work, however it ended.
4. **Reject the wrong vocabulary.** A session prompted for one kind of answer
   and returning another fails loudly rather than publishing the wrong state.
5. **Validate structured output before anything materialises.** A plan that
   would create unexecutable items creates **none**. Partial creation leaves a
   backlog someone cleans up by hand, in which the bad items look exactly like
   the good ones.
6. **Marker writes add; they do not replace.** Where the substrate's write
   operation replaces the whole set, read the current set and merge — a
   replacing write silently drops every other marker on the item, and nothing
   errors.
7. **Human-facing reports use the session's final message**, with the full
   transcript kept separately. A session that narrates while it works puts
   every aside into the transcript, and they land verbatim in the published
   artifact.
8. **A failed session says so** where a human will see it. A stage that
   silently produced nothing is indistinguishable from one never requested.

---

## C6 — Gates

Checks a change against claims that cannot be made by inspection.

| | |
| --- | --- |
| **In** | A change proposal; the baseline |
| **Out** | A verdict and a report, to the run's own output |
| **Must not know** | Anything about sessions, roles, or agents |

**Contract.**

1. **Least privilege, writing no state**, so gates can run on contributions
   from outside your trust boundary.
2. **Runnable without the automation.** A gate you cannot run locally is a
   gate you cannot test, and therefore cannot trust.
3. **"Wrong" and "could not decide" are distinct outcomes**, and only the
   first is overridable. Blurring them means a broken gate looks like an
   approved exception, and stays that way.
4. **Every gate has a human override** that records a reason — every gate has
   a legitimate exception, and a gate without an escape hatch gets disabled
   entirely the first time it blocks real work.
5. **The override state is read live, never from a replayed event.** Re-runs
   commonly replay the original payload, so a marker set *after* a failure is
   invisible to the re-run meant to observe it.
6. **The failure output states its own override procedure**, because nobody
   remembers the sequencing.
7. **Measure at the finest unit the harness reports honestly.** Report finer
   detail as information, never as a verdict: a verdict you cannot compute is
   one that will be approximated, and then trusted.
8. **Deterministic tooling runs first and unconditionally.** Only its residue
   reaches a session, scoped to that residue.

What gates are for, concretely: a new test that passes against the pre-change
code verifies nothing; deleting the failing test is the cheapest path to
green; and a change is only ready when its validation actually passed, not
when a session reported that it did.

---

## C7 — Render

Derives the current state of everything.

| | |
| --- | --- |
| **In** | The substrate's graph, read live |
| **Out** | One human-readable document |
| **Must not know** | Anything not derivable from that graph |

**Contract.**

1. **Derive; never store.** Stored status is a second source of truth, and a
   failed write leaves it wrong while looking right.
2. **A failed render leaves staleness, never falsehood** — with a visible
   timestamp. That property is what makes on-demand rendering safe: the worst
   an unpressed button can do is show you yesterday.
3. **Reproducible outside the automation**, for the same reason as C6-2.
4. **Derivation order is explicit and tested**, because conditions overlap and
   the precedence decides which failures hide. See the two orderings in
   [`00-the-model.md`](00-the-model.md#state-transitions).
5. **Refresh requests clear unconditionally**, sweeping every pending request
   rather than the one that fired — a stale view with the request still
   pending is a dead end.
6. **Flags a human must remember to set will be missing.** Derive per-item
   warnings from the item's declared scope instead.

---

## The seams, ranked

If you get only three boundaries right, these three:

| Seam | Protects |
| --- | --- |
| **C3's runtime confinement** | Substitutability. Everything above stays runtime-blind, so swapping one is a config change rather than a migration. |
| **C2's fetch list** | Every isolation guarantee. It is the only place they are real. |
| **C5's outcome gate** | The truthfulness of every published state. Without it, "finished" and "gave up halfway" look identical downstream. |
