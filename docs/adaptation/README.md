# Adaptation

**How an engineer and an agent companion move this pipeline onto different
tools.**

Not a set of pre-built ports — there is no way to anticipate your stack, and a
guess dressed up as a mapping is worse than nothing. This is the *procedure*:
how to read the working implementation, find the places it touches its
platform, ask the right question of yours, and prove you got the answer right.

## What you are adapting from

One working implementation, on GitHub Actions:
[`../../templates/github-actions/`](../../templates/github-actions/) — about
22,000 lines, lifted from a production system.

It is the reference not because GitHub is correct, but because **it is the one
that actually runs**. Every seam in the catalogue is a line you can open and
read, and every claim about what breaks is something that broke.

## The method, in one page

```
  ┌────────────────────────────────────────────────────────────┐
  │ 0  SURVEY        what can your tools do?                    │
  │                  → 01-survey.md                             │
  └───────────────────────────┬────────────────────────────────┘
                              ▼
  ┌────────────────────────────────────────────────────────────┐
  │ 1  TRANSLATE     for each seam: what is it really doing?    │
  │                  what is your equivalent? how would you     │
  │                  know you picked wrong?                     │
  │                  → 02-seam-catalogue.md                     │
  └───────────────────────────┬────────────────────────────────┘
                              ▼
  ┌────────────────────────────────────────────────────────────┐
  │ 2  BUILD         phase by phase, each with a done-test      │
  │                  → 03-procedure.md                          │
  │                  → 04-agent-playbook.md  (hand to the agent)│
  └───────────────────────────┬────────────────────────────────┘
                              ▼
  ┌────────────────────────────────────────────────────────────┐
  │ 3  PROVE         run the equivalence tests                  │
  │                  → 05-equivalence-tests.md                  │
  └───────────────────────────┬────────────────────────────────┘
                              ▼
  ┌────────────────────────────────────────────────────────────┐
  │ 4  RECORD        what you did differently, and why          │
  │                  → 06-deviation-log.md                      │
  └────────────────────────────────────────────────────────────┘
```

## The documents

| | |
| --- | --- |
| [`01-survey.md`](01-survey.md) | Fill this in **first**. Capabilities, marker primitive, identity limits, toolchain commands. Every later step refers to it. |
| [`02-seam-catalogue.md`](02-seam-catalogue.md) | **The translation aid.** Every place the implementation touches its platform, what it is doing abstractly, the question to ask yours, and *the tell* — what you observe if your substitute is wrong. |
| [`03-procedure.md`](03-procedure.md) | Build order. Phases sized for one session each, every one with a done-test. |
| [`04-agent-playbook.md`](04-agent-playbook.md) | Prompts to hand your agent companion, one per phase, each with inputs, outputs and acceptance criteria. |
| [`05-equivalence-tests.md`](05-equivalence-tests.md) | Substrate-independent behavioural tests. Your port is right when these pass. |
| [`06-deviation-log.md`](06-deviation-log.md) | Template for what you did differently. |

## How the pair divides the work

The two of you are good at different halves, and the split is not arbitrary.

| | The engineer | The agent companion |
| --- | --- | --- |
| Knows | Your tools, your org's constraints, what is politically possible | The reference implementation, in detail, all 22,000 lines |
| Decides | The marker primitive, the identity model, what you will not do | Nothing |
| Does | Answers the survey; approves each phase | Reads seams, drafts translations, writes the code, runs the tests |
| Catches | "That will never get approved here" | "The reference does this for a reason and you have dropped it" |

**The agent must not choose the marker primitive**, and that is the one
division worth stating as a rule. It is the most consequential decision in the
port ([`02-seam-catalogue.md#s-a1`](02-seam-catalogue.md#s-a1--the-trigger)),
it depends on facts about your organisation that are not in any repository —
who has admin, what a schema change costs, whether people work from phones —
and an agent will confidently pick the one that reads best in the docs.

**The engineer must not skip the equivalence tests.** They are where "I think
that's equivalent" becomes "I checked." Most of what this document exists to
prevent is a plausible-looking substitution that is wrong in one direction
nobody tested.

## Three ways this goes wrong

**Translating syntax instead of intent.** The reference calls `gh pr view`
with an explicit field list. Translated as "fetch the pull request", the
context isolation is gone and nothing indicates it — the port works, and the
reviewer quietly reads the implementer's own account of its work. Every seam
in the catalogue states the intent first for exactly this reason.

**Keeping a seam that your platform makes unnecessary.** Some of the reference
is scar tissue for GitHub-specific behaviour. If your tracker has real typed
dependency links, you do not need the body-table parsing. The catalogue marks
these **"may not apply"** — and dropping one is a deviation worth recording,
because the next person will wonder where it went.

**Dropping a seam your platform also needs.** More dangerous and more common.
The tell is always the same: the port works, nothing errors, and a property
you did not know you had is gone. That is what the equivalence tests are for.

## Start

1. Read [`../PIPELINE.md`](../PIPELINE.md), if you have not. You cannot
   translate a system you cannot describe.
2. Fill in [`01-survey.md`](01-survey.md). Do not skip the two questions it
   says are never obvious.
3. Build [tier 0](../architecture/02-substrate.md#tier-0--the-minimal-realization)
   — the whole control plane as forty lines of shell over a directory of
   files. It conforms, it takes an afternoon, and it is much cheaper to
   discover the shape is wrong there than inside your platform's config.
4. Then work the catalogue.
