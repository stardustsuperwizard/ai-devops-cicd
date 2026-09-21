# Realizations

A realization is the architecture expressed on one substrate. **They are
evidence, not the product.** The architecture is in
[`../architecture/`](../architecture/) and the rules are in
[`../../RULES.md`](../../RULES.md); everything here exists to show that those
close on real systems, and to save you the translation.

If your substrate is not listed, that is not a gap. Work from
[`../architecture/02-substrate.md`](../architecture/02-substrate.md), which
states the architecture in capabilities rather than products, and from the
build guide.

## What is here

| | Substrate | Form |
| --- | --- | --- |
| [Tier 0 — shell and files](../architecture/02-substrate.md#tier-0--the-minimal-realization) | None. A shell, a directory, an agent binary | ~40 lines of shell, annotated |
| [`jira-jenkins.md`](jira-jenkins.md) | Jira + Jenkins + any SCM | Prose, with the wiring spelled out |
| [`github-actions/`](github-actions/) | GitHub + Actions | Working files, copy-pasteable |

Start with tier 0 whichever substrate you are heading for. It is the whole
control plane in one screen, and confirming the shape there is much cheaper
than discovering it is wrong inside someone's workflow YAML.

## Substrate capabilities, compared

From [`../architecture/02-substrate.md`](../architecture/02-substrate.md).
Nothing in the middle columns is missing; all four are complete targets.

| | Tier 0 | GitHub | Jira + Jenkins | GitLab | Azure DevOps |
| --- | --- | --- | --- | --- | --- |
| **S1** Work item | A Markdown file | Issue | Jira issue | Issue | Work Item |
| **S2** Hierarchy | `parent:` field | Sub-issues | Epic → Story → Sub-task | Epic/child | Parent/Child |
| **S3** Dependency | `blocked_by:` list | `blocked-by` | Link types (rich) | "blocked by" | Predecessor |
| **S4** Marker | Front matter | Label | Label field | Label | Tag |
| **S5** Notification | A person | `labeled` event | Webhook, or poll | Webhook | Service hook |
| **S6** Session | A shell | Composite action | Shared-library step | Job template | Pipeline template |
| **S7** Proposal | Branch + review file | Pull request | PR in the SCM, linked by key | Merge request | Pull Request |
| **S8** Comment | Appending to a file | Comment | Jira comment | Note | Comment |
| **Tier** | 0 | 2 | 2–3 | 2–3 | 3 |

Tier definitions are in
[`../architecture/02-substrate.md`](../architecture/02-substrate.md#capability-tiers).

## What each substrate gives you, and takes

| Substrate | Gives | Costs |
| --- | --- | --- |
| **Tier 0** | Runs anywhere; the whole control plane readable in one sitting; nothing to configure | No mobile dispatch; no automatic stages; you are the scheduler |
| **GitHub** | Zero-setup automation identity; fork-safe read-only tokens; dispatch from any client | Thin dependency links; no structural preconditions on state transitions |
| **Jira + Jenkins** | Rich dependency types; typed fields for tiers; **workflow validators that enforce the cold-start test structurally**; controlled execution nodes | Two systems to wire; credentials to design; draft state and review UI to rebuild |
| **GitLab** | Near one-to-one with GitHub; stronger approval rules for human-decision boundaries | Job templates are variable-driven rather than typed |
| **Azure DevOps** | Typed pipeline parameters; a rules engine that can enforce preconditions | Heavier configuration surface |

**The Jira row is the interesting one.** A workflow validator that refuses a
transition to *dispatchable* unless acceptance criteria are non-empty enforces
**HND-3** structurally, which is strictly better than validating it inside the
planner — because it cannot be argued with. Where a substrate can make a rule
impossible to break, prefer that over checking it.

## Writing a new realization

Structure it as the seven components (**C1–C7**), because that is what makes
two realizations comparable. Specifically:

1. **Name the marker primitive first**, and say whether a non-admin can set it
   from a phone in two taps. Everything else follows from that answer, and it
   is the one most often decided by default.
2. **Say how the trigger is consumed**, and whether re-setting it is a clean
   retry. Where the substrate's write operation *replaces* a set rather than
   adding to it, say so loudly — it silently drops every other marker, and
   nothing errors.
3. **Show the session runner's capability translation**, both postures, both
   runtimes if you have two. This is where the additive/subtractive trap
   lives, and where it fails silently.
4. **State what the automation identity may not do.** There is always
   something, usually modifying its own configuration, and it has to be known
   at plan time rather than discovered at dispatch.
5. **Map every degradation you relied on** back to the table in
   [`../architecture/02-substrate.md`](../architecture/02-substrate.md).
6. **Run the self-assessment** in
   [`../architecture/04-conformance.md`](../architecture/04-conformance.md)
   and publish the answers, including the failures.

Then add a column to the comparison table above.
