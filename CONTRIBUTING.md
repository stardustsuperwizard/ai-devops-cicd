# Contributing

This repository collects infrastructure and AI-agent-development work extracted
from real projects. Two rules keep it useful.

## 1. Nothing goes in `docs/concepts/` that is not platform-agnostic

A concepts page describes a mechanism in terms of **work items, markers,
sessions and artifacts** — never Issues, labels, Actions or `gh`. If you cannot
write it without naming a vendor, it belongs in `templates/` or `examples/`.

Test: could someone building on Jira + Jenkins follow it? If not, rewrite or
move it.

## 2. Every claim names the failure it came from

The value here is not the architecture — it is knowing which parts were
learned the expensive way. When you add a rule, say what breaks without it.

> The fix is not better prose. It is removing the capability.

reads differently from "prefer tool restrictions", and the difference is the
sentence before it explaining what happened when prose was tried.

Avoid: "best practice", "consider", "it is recommended". Say what failed.

## Adding an extraction

1. Survey the source and update [`EXTRACTION_INVENTORY.md`](EXTRACTION_INVENTORY.md)
   — tier, line count, coupling, status.
2. Extract the **reasoning** into `docs/concepts/` first. The code without the
   reasoning is a snippet; the reasoning without the code is still useful.
3. Then the code into `templates/<platform>/`, with project-specific references
   genericized and every seam marked `TODO`.
4. Link the original in `examples/<project>/README.md` so a reader can see it
   working.

## Templates

- Must be **copy-pasteable** — no repo-relative `uses:` paths that only resolve
  here.
- Must mark every seam a consumer edits with `TODO`.
- Must be syntax-valid. YAML parses, Python compiles, `bash -n` passes.
- Keep the source's comments. They carry the reasoning, and they are most of
  why these files are worth copying rather than rewriting.

## Porting to a new platform

Fill in [`docs/porting/worksheet.md`](docs/porting/worksheet.md), then add a
column to the primitive table in
[`docs/porting/platform-mapping.md`](docs/porting/platform-mapping.md). If your
platform lacks a primitive, add the degradation to
[`docs/porting/reference-architecture.md`](docs/porting/reference-architecture.md)
rather than working around it silently — the next person will hit the same gap.
