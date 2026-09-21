# Reference architecture

The framework stated in **platform primitives**, so it can be rebuilt on any
tracker and any CI system. If your platform supplies the eight primitives
below, you can build this. If it is missing one, the *Degradations* section
says what to do instead.

This document is written to be read by a person or by an agent session doing a
port. The step-by-step build order is in
[`build-guide-for-agents.md`](build-guide-for-agents.md); the concrete
GitHub/Jira/GitLab/Azure mappings are in
[`platform-mapping.md`](platform-mapping.md).

## The eight primitives

| # | Primitive | Must support | Used for |
| --- | --- | --- | --- |
| P1 | **Work item** | A body of structured text, addressable by ID | The handoff contract |
| P2 | **Item hierarchy** | Parent ↔ child links | Epic → task |
| P3 | **Item dependency** | "A blocks B", queryable | Dispatch ordering |
| P4 | **Mutable marker** | A small attribute a human can add from any client | Triggers and state |
| P5 | **Marker-change event** | Automation fires when a marker is added | Dispatch |
| P6 | **Session runner** | Run a CLI with a prompt, a model, a tool policy, and capture stdout/stderr/exit | Everything |
| P7 | **Change proposal** | A branch + a reviewable diff + a comment thread + its own markers | Implement, review, fix |
| P8 | **Comment** | Durable, addressable text on an item or proposal | Plans, verdicts, reports |

Note what is **not** required: a board, a workflow engine with state machines,
an agent orchestration product, or any vendor-specific agent feature. Those
are conveniences, and two of them are actively harmful — see
[`../concepts/07-derived-state.md`](../concepts/07-derived-state.md).

## The seven components

```
                    ┌──────────────────┐
  marker added ────▶│  C1 Dispatcher   │  routes marker → role + vendor
                    └────────┬─────────┘
                             ▼
                    ┌──────────────────┐
                    │ C2 Prompt        │  fetches ONLY what the role may see
                    │    Assembler     │
                    └────────┬─────────┘
                             ▼
                    ┌──────────────────┐
                    │ C3 Session       │  vendor-blind: capability, models,
                    │    Runner        │  budget → text + outcome + cost
                    └────────┬─────────┘
                             ▼
                    ┌──────────────────┐
                    │ C4 Outcome       │  harness evidence → one vocabulary
                    │    Classifier    │
                    └────────┬─────────┘
                             ▼
                    ┌──────────────────┐
                    │ C5 Result        │  verdict / plan JSON → markers,
                    │    Publisher     │  items, comments
                    └────────┬─────────┘
                             ▼
          ┌──────────────────┴──────────────────┐
          ▼                                     ▼
 ┌─────────────────┐                  ┌──────────────────┐
 │ C6 Quality      │                  │ C7 Control Plane │
 │    Gates        │                  │    Renderer      │
 └─────────────────┘                  └──────────────────┘
```

### C1 — Dispatcher

Reads a marker of the form `agent:{role}:{vendor}`, fires the workflow for
`role`, passes `vendor` down, and **removes the marker it consumed**.

Requires P4 + P5. Constraints:

- One workflow per **role**, not per vendor. Vendor is an input. Three
  workflows per role means three places to fix a bug in the role.
- Never fire on your own output. Audit this explicitly; it is how you get a
  loop that spends real money.
- Removal is what makes re-adding a clean retry.

### C2 — Prompt Assembler

Fetches exactly the fields the role may see, and writes the prompt to a
scratch path **outside the checkout**.

Requires P1, P7, P8. Constraints:

- **Fetch-list is the isolation mechanism.** See
  [`../concepts/04-context-isolation.md`](../concepts/04-context-isolation.md).
  Enumerate fields explicitly; never fetch "the whole item".
- **Pass the prompt by file path or stdin, never as a command-line
  argument.** Linux caps a single argument at 128 KiB (`MAX_ARG_STRLEN`), and
  a diff-bearing prompt exceeds that long before the larger `ARG_MAX` applies.
  This failure is abrupt and the error message is unhelpful.
- Scratch lives in the runner's temp directory, never the working tree — a
  prompt file in the checkout can end up committed.

### C3 — Session Runner

**The single most important component to get right**, because it is the one
place vendor differences are allowed to exist.

Inputs:

| Input | Notes |
| --- | --- |
| `vendor` | Resolves to a **(cli, auth)** pair — see below |
| `prompt-file` | Absolute, in scratch |
| `models` | Comma-separated preference list, walked in order |
| `capability` | `read-only` \| `write` — **one semantic knob**, defaulting to `read-only` |
| budget caps | Per-vendor; credits and turns are **not** convertible |

Outputs:

| Output | Notes |
| --- | --- |
| joined assistant text | Everything the session said |
| **final message only** | The completion report — prefer this for human-facing rendering |
| outcome JSON | One schema for all vendors |
| duration / cost | Written on **every** path, including total failure |
| failure JSON | Only when no model produced usable output |

**A vendor names a billing arrangement, not a program.** Resolve it once into
two independent facts and let nothing downstream re-derive the mapping:

| vendor | cli | credential | billed to |
| --- | --- | --- | --- |
| `copilot` | Copilot CLI | the CI identity | Copilot premium requests |
| `anthropic` | Claude Code | API key | platform API credit |
| `claude` | Claude Code | OAuth token | a subscription |

The last two are the **same binary on the same model IDs**, differing only in
who pays. That is the point of splitting them: who pays is chosen by putting a
marker on a work item, not by editing a workflow.

Above C3 everything is vendor-blind. Below it, two CLIs disagree about flags,
output shape and failure phrasing — and that disagreement is **confined
here**.

### C4 — Outcome Classifier

One per CLI, writing one schema. See
[`../concepts/08-session-outcomes.md`](../concepts/08-session-outcomes.md).
Classify from harness evidence only.

### C5 — Result Publisher

Parses the session's text into something structured and writes it back.

- For a **planner**: validate the plan JSON structurally, then create items,
  wire dependencies, post the plan comment, swap `plan` → `planned`.
- For a **reviewer**: extract the verdict, **refuse to publish it if the
  session was truncated**, post the report, set the `review:*` marker.
- Read current markers before writing, if your API's marker-set operation
  **replaces** rather than **adds**. This asymmetry between API surfaces is a
  classic silent data loss.

### C6 — Quality Gates

See [`../concepts/09-quality-gates.md`](../concepts/09-quality-gates.md). All
must run on a read-only token.

### C7 — Control Plane Renderer

Derives every state from the tracker graph and rewrites one pinned document.
See [`../concepts/07-derived-state.md`](../concepts/07-derived-state.md).
Requires nothing but read access, and must be runnable locally.

## The role ↔ component matrix

| Role | Capability | Tier | Assembler must NOT fetch | Publishes |
| --- | --- | --- | --- | --- |
| Planner | read-only | strong | previous failed plans | task items, plan comment, `planned` |
| Implementer | write | per-task | epic task list, sibling items | branch, change proposal, `validation:failed` |
| Reviewer | read-only | strong | the proposal's description | verdict comment, `review:*` |
| Fixer | write | middle, escalating | already-answered verdicts | commits on the same branch |
| Triage | read-only, no checkout | cheap | the code | deferred-finding items |

## Degradations

What to do when a primitive is missing or weak.

| Missing | Symptom | Do this instead |
| --- | --- | --- |
| **P5** marker-change events | Nothing dispatches automatically | Poll on a schedule (every 5–15 min) for items carrying a trigger marker. Poll-and-consume is the same contract; only latency changes. |
| **P3** dependencies | Cannot order dispatch | Keep a `## Dependencies` table in the item body and parse it. This is worth doing **anyway**, as the human-readable source that syncs into the native links. |
| **P4** markers | No trigger surface | Use a status field with a dedicated "agent requested" value, or a named component/tag. Anything a human can set from a phone in two taps. |
| **P2** hierarchy | No epic → task | Put the parent ID in a field and a `Parent: X` line in the body. Derive the tree at render time. |
| Board-change events only at org scope | Board automation is unavailable | Do **not** build on the board. Render a document instead — see C7. |
| Per-role model config | Only one session-wide chain | Make the chain **escalate-only**. See [`../concepts/05-model-tiering.md`](../concepts/05-model-tiering.md). |
| CI cannot push to CI config | Some tasks are undispatchable | Detect at plan time from expected files, mark them 🔑, and route to a human. |

## Invariants — do not trade these away

1. Each role is a **separate session**.
2. Constraints are **capabilities removed**, not instructions added.
3. The handoff is an artifact a **cold session** can read.
4. Control-plane state is **derived**, never stored twice.
5. Vendor differences live in **exactly one file**.
6. A truncated session **never publishes a verdict**.
7. Model spend on a new decision requires a **human tap**.

If a port breaks one of these, it is not a port of this architecture. It is a
different system that will fail in the ways this one was built to stop.
