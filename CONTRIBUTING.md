# Contributing

This repository is an **architectural guide and rule set**. Code here is
evidence, never the product. Three rules keep it that way.

## 1. Nothing in `docs/architecture/` or `RULES.md` names a product

The architecture is stated in **work items, markers, sessions, artifacts and
substrates** — never Issues, labels, pipelines, `gh`, or any vendor's name.

Test: could someone on a stack you have never heard of follow it? Could
someone with no stack at all — a shell and a directory — follow it? If not,
rewrite it, or move it to [`templates/github-actions/`](templates/github-actions/).

A rule that can only be obeyed on one platform is not a rule. It is a
realization detail.

## 2. Every rule names the failure it came from

The value here is not the architecture. It is knowing which parts were learned
the expensive way.

> The fix is not better prose. It is removing the capability.

reads differently from "prefer tool restrictions", and the difference is the
sentence before it saying what happened when prose was tried.

Avoid "best practice", "consider", "it is recommended". Say what broke.

## 3. A rule is not a rule unless it can be checked

Every entry in [`RULES.md`](RULES.md) carries four parts:

| | |
| --- | --- |
| **Statement** | MUST / SHOULD / MAY, in one sentence |
| **Why** | The property it protects |
| **Fails as** | What you actually observe when it is broken — usually not an error |
| **Verify** | How to check, without trusting anyone's word |

**Verify** is the hard one and the one that matters. "Review the code" is not
verification. "Run a read-only session asked to write a file; assert the file
does not exist" is.

If you cannot write a **Verify**, the rule is probably advice. Advice belongs
in [`docs/rationale/`](docs/rationale/).

## Adding a rule

1. Write the field note in `docs/rationale/` first — what broke, and why the
   obvious fix did not work.
2. Add the rule to `RULES.md` in the right group, with the next free ID.
   **IDs are stable and never reused**; they are cited in commits and reviews.
3. Add its check to the self-assessment in
   [`docs/architecture/04-conformance.md`](docs/architecture/04-conformance.md).
4. Update the rationale page's *Rules this justifies* banner.
5. If it changes a component's contract, update
   [`docs/architecture/01-components.md`](docs/architecture/01-components.md).

Before adding one, try to fold it into an existing rule. Ninety-eight rules is
past the limit of what anyone reads in one sitting; a new group needs to earn
itself, and a new rule needs to be one an existing rule does not already
cover.

## Adding a seam to the catalogue

[`docs/adaptation/02-seam-catalogue.md`](docs/adaptation/02-seam-catalogue.md)
is the translation aid, and it only works if every entry has all four parts:

| | |
| --- | --- |
| **Does** | A line in the reference someone can open |
| **Means** | The intent. This is what gets translated — never the syntax |
| **Ask** | The question to put to another platform |
| **The tell** | What you observe when a substitute is wrong |

**The tell is the part that earns the entry.** Anyone can list what a line
does; the value is knowing that getting it wrong produces no error, and what
you see instead. If you cannot write a tell, the seam is probably not a seam —
it is a line of code.

Add an equivalence test in
[`05-equivalence-tests.md`](docs/adaptation/05-equivalence-tests.md) for any
seam whose failure is silent, and mark it 🔴.

## Reporting a port

Publish the conformance self-assessment from
[`docs/architecture/04-conformance.md`](docs/architecture/04-conformance.md),
including the failures, and the deviation log.

**A port that reports no findings has not been assessed.**

## Code in this repository

Only inside `templates/github-actions/`, and only when it demonstrates a
contract. It is the reference the whole adaptation method reads, so its
comments are load-bearing documentation rather than commentary.

- **Copy-pasteable** — no repo-relative references that resolve only here.
- **Every consumer-edited seam marked `TODO`.**
- **Syntax-valid**: YAML parses, Python compiles, `bash -n` passes.
- **Keep the comments.** They carry the reasoning, and they are most of why
  these files are worth copying rather than rewriting.
- **Cite the rule** a non-obvious line exists to satisfy.

## Extraction from a source system

Track it in [`EXTRACTION_INVENTORY.md`](EXTRACTION_INVENTORY.md): tier, line
count, coupling, status.

Extract the **reasoning** before the code, every time. The code without the
reasoning is a snippet; the reasoning without the code is still an
architecture.
