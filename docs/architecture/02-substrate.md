# Substrate

What the architecture needs from whatever you have, and what to do when you do
not have it.

**"Regardless of the services available" is a claim this page has to earn.**
So it ends with the smallest realization that is still this architecture: a
shell, a directory, and an agent binary. No tracker, no CI, no platform.

## The eight capabilities

Not products — capabilities. Any of them can be supplied by a database, a
directory of files, or a person with a spreadsheet.

| | Capability | Minimum viable form |
| --- | --- | --- |
| **S1** | **Identified work item** — structured text, stable ID, mutable | A Markdown file named `TASK-007.md` |
| **S2** | **Hierarchy** — parent ↔ child | A `parent:` field |
| **S3** | **Dependency** — "A blocks B", queryable | A `blocked_by:` list |
| **S4** | **Marker** — a small attribute, set and cleared independently of the text | A line in the file's front matter |
| **S5** | **Notification** — something observes a marker change | A person; a cron job; a file watcher |
| **S6** | **Session execution** — run a program with a prompt, a model, a tool policy; capture output and exit status | A shell |
| **S7** | **Change proposal** — reviewable changes, a comment surface, its own markers | A branch and a review file |
| **S8** | **Durable comment** — addressable text attached to an item | Appending to the file |

Note what is **not** required: a project board, a workflow engine, an agent
orchestration product, or any vendor's agent feature. Two of those are
actively harmful — a board is a second source of truth that cannot cause work,
and in-product orchestration collapses the per-role tiering.

## Capability tiers

Systems tend to fall into four bands. Each is workable; they differ in latency
and ceremony, not in conformance.

| Tier | You have | Looks like |
| --- | --- | --- |
| **0 — Local** | A shell and an agent binary | Files, a script, a human loop |
| **1 — Tracker only** | A tracker; no automation runner | Markers dispatch a human who runs a script |
| **2 — Tracker + runner** | Both, with events | The full pipeline, automatic |
| **3 — Tier 2 + policy** | Plus workflow validators, approval rules, typed fields | Contracts enforced *structurally* rather than checked |

A tier-3 substrate can enforce the cold-start test as a precondition on a
state transition — strictly better than validating it inside the planner,
because it cannot be argued with. Use it where you have it.

## Degradations

A missing capability is a known substitution, not a blocker. Each of these
preserves conformance.

| Missing | Symptom | Substitute |
| --- | --- | --- |
| **S5** notification | Nothing dispatches by itself | **Poll.** Scan on an interval for items carrying a trigger. Identical contract; only latency changes — which this architecture does not optimise for. |
| **S4** markers | No trigger surface | A status field with a dedicated "requested" value; a tag; a naming convention on a branch. Anything a person can set in two taps without admin rights. |
| **S3** dependencies | Cannot order dispatch | A dependency table **in the item body**, parsed at render time. Worth doing anyway: the body is human-readable and reviewable, where native links are neither. |
| **S2** hierarchy | No parent ↔ child | A parent field plus a line in the body. Derive the tree when rendering. |
| **S7** proposals | No review surface | A branch plus a review artifact committed beside the change. Review does not require a product. |
| Events only at a scope you lack | Automation cannot see them | Do not build on that surface at all. Derive instead. |
| Per-role model configuration | One setting for a whole session | Make the fallback **escalate-only**. A shared chain that descends hands cheap models work that was deliberately tiered up. |
| Runner cannot modify its own configuration | A class of work is undispatchable | Detect it at plan time from the item's declared scope and route to a human. Do not discover it at dispatch. |
| No second runtime available | Cannot switch payer or vendor | Build the runtime parameter anyway. It costs one branch in one file and is the seam that keeps everything above it blind. |

## Choosing a marker primitive

The most consequential substrate decision, and the one most often made by
default.

| Candidate | Multi-valued | Settable without admin | Mobile | Queryable |
| --- | --- | --- | --- | --- |
| Free-form labels/tags | ✅ | ✅ | ✅ | ✅ |
| Status / state field | ❌ one at a time | Often not | ✅ | ✅ |
| Typed custom field | Depends | Usually not | ✅ | ✅ |
| Front matter in a file | ✅ | ✅ | ❌ | grep |
| Directory position | ❌ | ✅ | ❌ | ✅ |

**Multi-valued matters more than it looks.** `blocked` and "review this
please" and a tier must coexist on one item. A single-valued status field
forces you to encode combinations as states, and the state count explodes.

**Settable-without-admin matters more still.** If changing the marker
vocabulary needs a schema change, the vocabulary stops evolving, and people
work around it.

Whatever you pick: create the whole vocabulary up front, idempotently, before
believing anything works. Triggers key on a **name**, and on a substrate where
the name does not exist yet, every stage is inert — with no error, no log, and
nothing to find. That silence is mistaken for "not triggered yet" for as long
as it takes someone to guess.

## Tier 0 — the minimal realization

The existence proof. No tracker, no CI, no platform, no network beyond the
agent itself.

```
project/
  backlog/
    EPIC-001.md
    TASK-007.md          ← S1: a work item
    TASK-008.md
  .pipeline/
    prompts/             ← C2 scratch, outside the source tree
    sessions/            ← transcripts, outcomes, costs — S8 and OBS-6
    run                  ← C1+C3+C4+C5, one script
```

A work item, front matter carrying S2–S4:

```markdown
---
id: TASK-007
parent: EPIC-001
blocked_by: [TASK-006]
markers: [implementation, model:middle]
---
## Objective
## Scope
## Expected changes
## Constraints
## Acceptance criteria
## Out of scope
```

Dispatch is a person typing a command — which is S5 at its most honest, since
a human deciding to start a session is the human act the architecture requires
anyway:

```sh
.pipeline/run review TASK-007
```

And that script is the whole control plane:

```sh
#!/bin/sh
# C1 dispatch ── role and item from argv; the human act is the invocation
role=$1; item=$2
set -eu

# C2 assemble ── the fetch list, made literal. Note what is NOT concatenated:
#     the branch's own description never reaches the reviewer.
prompt=.pipeline/prompts/$item.$role.md
{ cat prompts/$role.md
  cat backlog/$item.md
  [ "$role" = review ] && git diff main...HEAD
} > "$prompt"

# C3 run ── capability is one knob, translated here and nowhere else
case $role in
  plan|review) tools="--allowedTools Read,Grep,Glob" ;;
  implement|fix) tools="--allowedTools Read,Grep,Glob,Edit,Write,Bash" ;;
esac
start=$(date +%s)
agent -p --model "$(tier_of "$item")" $tools < "$prompt" \
  > .pipeline/sessions/$item.$role.txt 2> .pipeline/sessions/$item.$role.err
status=$?

# C4 classify ── from exit status and stderr. Never from the answer.
outcome=$(classify "$status" .pipeline/sessions/$item.$role.err)

# OBS-6 ── recorded on every path, including this one failing
printf '%s\t%s\t%s\t%s\t%s\n' "$item" "$role" "$outcome" \
  "$(( $(date +%s) - start ))" "$(date -u +%FT%TZ)" >> .pipeline/ledger.tsv

# C5 publish ── the outcome gate, before the content is believed
[ "$outcome" = completed ] || { echo "not publishing: $outcome" >&2; exit 1; }
publish "$role" "$item" .pipeline/sessions/$item.$role.txt
```

Check it against the load-bearing six:

| Rule | Held by |
| --- | --- |
| DEC-1 roles are stages | Four prompt files, one per stage |
| DEC-2 separate sessions | One `agent` invocation per stage |
| CAP-1 capability removal | The `case` — the reviewer has no `Edit`, so it cannot fix what it finds |
| CTX-1 isolation by not fetching | The `{ ... }` block. The branch description is not in it |
| HND-1 durable artifacts | `backlog/*.md`, the diff, the session transcripts |
| HND-3 cold start | The item template's required sections |

Forty lines of shell. It conforms.

What you lose at tier 0 is **latency and ergonomics**, not architecture: no
mobile dispatch, no automatic review on readiness, no derived board beyond
what a script prints. What you gain is that it runs anywhere, and that anyone
can read the whole control plane in one sitting.

**This is the fallback whenever a substrate question stalls.** Build tier 0,
confirm the shape is right, then lift it onto whatever you have. Every
realization in [`../../templates/github-actions/`](../../templates/github-actions/) is this script with
someone else's nouns.

## Surveying a substrate you did not choose

Working in an organisation with a mandated stack, in order:

1. **Find the marker primitive.** Everything else follows from it. If nothing
   multi-valued is settable without admin, that is your first negotiation.
2. **Find out whether anything can observe a change.** If not, you are
   polling, and that is fine.
3. **Find out what the automation identity may *not* do.** There is always
   something — usually modifying its own configuration. That set defines the
   work that needs a human, and it must be known at plan time.
4. **Find the least-privilege execution path**, for gates that run on
   contributions from outside the trust boundary.
5. **Assume nothing about ordering or delivery.** Events arrive late, twice,
   or never. Every stage is idempotent and re-runnable; the render is derived
   so a missed event only makes it stale.

Record the answers in [`../adaptation/01-survey.md`](../adaptation/01-survey.md)
before writing anything.
