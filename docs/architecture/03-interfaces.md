# Interfaces

The data that crosses each boundary. Described as **fields and meanings**, not
as a file format — the shapes below are illustrated in JSON and YAML because
something has to be on the page, but Markdown sections, database columns and
form fields are equally valid carriers.

What matters is that each field exists, means one thing, and is produced and
consumed by exactly the components named.

---

## I1 — The work item

**Produced by** the planner (or a human). **Consumed by** implement, review,
fix, and the renderer. The whole contract; see **HND-2**.

| Field | Required | Meaning |
| --- | --- | --- |
| `id` | ✅ | Stable identifier |
| `title` | ✅ | One line. Conventionally prefixed to signal its level |
| `parent` | | The intake item it decomposes — **context only, never authorization** |
| `objective` | ✅ | What must be true afterwards |
| `scope` | ✅ | What this item covers |
| `expected_changes` | ✅ | Where the change is expected to land. Also what the renderer derives per-item warnings from |
| `constraints` | | Architectural rules this must respect |
| `acceptance_criteria` | ✅ | **Checkable** statements. The review stage's entire basis |
| `out_of_scope` | ✅ | What is deliberately not included. Without it, review is a judgement call |
| `depends_on` | | Items that must complete first |
| `tier` | ✅ | Cost tier — **never a model identifier** (**SES-8**) |
| `tier_reasoning` | | Prose for a human. Nothing re-reads it |

**Acceptance criteria are the field everything hinges on.** They are what the
reviewer compares the change against, and what makes "done" a fact rather than
an opinion.

- ✅ "`resolve()` returns `null` for an unknown key rather than raising."
- ❌ "Works correctly."
- ❌ "Follows best practices."

**The cold-start test** (**HND-3**): could someone who has read only this item
do the work and know when they were finished?

---

## I2 — The plan record

**Produced by** the planner. **Consumed by** humans, and by a plan review if
you have one. It is **not** consumed by the implementer — that is HND-2.

| Field | Meaning |
| --- | --- |
| `summary` | What this decomposition does and why |
| `architecture_notes` | Decisions that apply across the items |
| `items[]` | The created items, with IDs and one-line descriptions |
| `dependency_graph` | The ordering, as stated |
| `unwired[]` | Dependencies the planner could **not** record, and why |

`unwired` matters more than it looks. Where a substrate cannot express
something the planner needed — a dependency type it lacks, a link its API does
not reach — the planner **reports the gap** instead of improvising or staying
silent. A dependency nobody knows is missing is worse than one that is.

### I2a — The planner's structured output

Emitted before anything materialises, validated by C5, and discarded once the
items exist.

```json
{
  "summary": "…",
  "architecture_notes": "…",
  "tasks": [
    {
      "title": "…",
      "objective": "…",
      "scope": "…",
      "expected_changes": ["…"],
      "constraints": ["…"],
      "acceptance_criteria": ["…", "…"],
      "out_of_scope": ["…"],
      "depends_on": ["<title or index within this plan>"],
      "tier": "cheap | middle | strong",
      "tier_reasoning": "…"
    }
  ]
}
```

**Validation gates, all of which fail the whole run (HND-4):**

| Check | Prevents |
| --- | --- |
| `acceptance_criteria` non-empty | An item that can be neither executed cold nor reviewed |
| Every `depends_on` resolves **within this plan** | A permanently blocked item |
| No cycles | An epic where nothing is ever dispatchable |
| `scope` and `out_of_scope` present | Review by judgement call |
| `tier` in the allowed set | Silent fallback to a default nobody chose |
| Item count within a bound | A planner that failed to decompose, emitting forty items |

A plan failing any of these creates **no** items. Partial creation leaves a
backlog someone cleans up by hand, in which the bad items look exactly like
the good ones.

---

## I3 — The session outcome

**Produced by** C4. **Consumed by** C5 and the ledger. **One schema across
every runtime** (**OUT-1**) — if two runtimes' schemas diverge, everything
upstream starts branching on runtime identity again.

```json
{
  "outcome": "completed",
  "model": "<the identifier actually used>",
  "runtime": "<which program>",
  "payer": "<which credential>",
  "exit_status": 0,
  "duration_seconds": 184,
  "cost": { "unit": "turns", "spent": 23, "cap": 60 },
  "event_counts": {},
  "guidance": ""
}
```

**The vocabulary** — closed, and ordered by precedence. Classify to the first
that matches; the more specific cause first, because the guidance differs.

| Value | Meaning | Retry? |
| --- | --- | --- |
| `harness_error` | The runtime itself failed — install, flags, transport | Yes, after fixing |
| `model_unavailable` | Not reachable for this identity | **Advance the preference list** |
| `budget_exhausted` | Hit its ceiling | Only with a higher cap |
| `rate_limited` | Throttled | Yes, later |
| `session_error` | Ran, failed inside itself | Investigate — **never** advance the list |
| `no_assistant_output` | Produced nothing usable | Investigate |
| `completed` | Finished on its own terms | — |

Three properties of this schema, each load-bearing:

- **`event_counts` is `{}`, not absent,** where a runtime has no event stream.
  A consumer must not get a null because the runtime changed (**OUT-2**).
- **`cost.unit` is explicit.** Runtimes meter in different units and there is
  no conversion; a cap tuned on one is not tuned on another (**SES-10**).
- **`guidance` names the specific remedy**, including which credential — which
  differs by payer even on the same program. Guidance naming the wrong one
  sends a reader to fix something that was never broken.

`completed` means *the session ended on its own terms*. It does **not** mean
the work was done, or done well. That judgement belongs to review.

---

## I4 — The verdict

**Produced by** the review stage, extracted by C5. **Consumed by** the
dispatcher (for routing), the renderer, and humans.

```
<machine-readable verdict>       ← first line, parsed
<structured report>              ← everything after
```

**The vocabulary** — four values, because they route to four different places
(**OUT-6**):

| Verdict | Means | Routes to |
| --- | --- | --- |
| `PASS` | Meets the criteria | Integration |
| `FIX` | The work is wrong; the contract was right | The correction loop |
| `PLANNING FAILURE` | The item was unexecutable as written | **Planning.** A fixer cannot help |
| `DESIGN AMBIGUITY` | The contract is underspecified in a way needing a decision | **A human.** No model supplies a missing decision |

Collapsing these to pass/fail is the most expensive simplification available:
contract failures get sent to the correction loop, where they consume every
escalation round and produce nothing.

**Required sections**, all checked for presence before publication (**OUT-7**):

1. **Criteria** — a row per acceptance criterion, met or not
2. **Scope** — anything in the change the item did not authorize
3. **Findings** — each located precisely
4. **Deferred findings** — real, but out of scope for this item
5. **Tests** — do the new tests actually exercise the new behaviour?
6. **Summary**

### The extraction gate

```
if outcome ∉ {completed}              → publish a failure, not a verdict
if required sections missing          → publish a failure, not a verdict
if verdict vocabulary ≠ requested     → fail loudly
else                                  → publish
```

**The verdict is on the first line, which makes truncation the dangerous case
rather than the obvious one.** A review cut off halfway through its criteria
table still says `PASS` at the top. Without this gate the review stage is
theatre, and silently so.

**Deferred findings** are the input to a backlog-hygiene stage, if you build
one: they are judgements already made, by a session that had the context, that
nothing currently acts on. Turning an already-made judgement into a work item
is one of the few things that does not need its own human tap.

---

## I5 — The ledger row

**Produced by** every stage, on **every** path including total failure
(**OUT-10**, **OBS-6**). **Consumed by** whoever asks what this is costing.

| Field | Why it is here |
| --- | --- |
| `timestamp` | |
| `item` | |
| `role` | |
| `tier` | The tier **requested** |
| `model` | The model **actually used** — not the same thing when the list advanced |
| `runtime`, `payer` | |
| `outcome` | From I3 |
| `duration_seconds`, `cost` | |
| `verdict` | Where the stage produced one |
| `round` | Which correction round, for escalation and the cap |

Keep `tier` and `model` separate. When they differ, a fallback fired — and a
ledger that records only the model cannot tell you that work tiered up was
done cheaply.

Two questions this table must be able to answer, and which nothing else can:

- **Which role fails most, at which tier?** Distinguishes a tier set too cheap
  from work items written badly. Those have opposite fixes, and guessing wrong
  costs weeks.
- **What does one completed item cost, end to end, including the rounds that
  failed?** The only honest number.

---

## I6 — The marker vocabulary

**Produced by** the bootstrap. **Consumed by** everything.

| Marker | Kind | Set by | Cleared by |
| --- | --- | --- | --- |
| `agent:{role}:{runtime}` | trigger | **human** | the stage |
| `awaiting-planning` | state | intake | the planner |
| `planned` | state | the planner | — |
| `implementation` | state | the planner | — |
| `model:{tier}` | state | the planner | — |
| `blocked` | **both** | planner, human | never (see **DSP-4**) |
| `review:{verdict}` | state | review | the next verdict |
| `validation:failed` | state | implement | a passing validation |
| `{gate}-approved` | state | **human only** | never |
| `dashboard` | state | the renderer | — |
| `refresh` | **button** | human | the render, always |

Four things this table encodes that are easy to lose:

- **The trigger's runtime segment is the routing** (**DSP-6**). Switching who
  answers, or who pays, is setting a different marker — not editing a file.
- **`awaiting-planning` and `planned` are mutually exclusive by
  construction** (**DSP-5**). That is what makes a query over them an *exact*
  queue rather than an approximate one.
- **`blocked` is both trigger and state**, which costs the retry story:
  re-setting a marker that is already present is not an event. Provide a
  manual sweep (**DSP-4**).
- **Gate approvals are set by humans and read live** — never from a replayed
  event, or a marker set after a failure is invisible to the re-run meant to
  observe it (**DSP-10**).

Adapt the names to your substrate's constraints — no spaces, length caps,
reserved characters — then fix them. Renaming a marker after dispatch depends
on it means finding every trigger keyed on the old name, and the ones you miss
fail by going silent.
