# <Project name>: notes for AI agents

<!-- ADAPT: one sentence on what the project is. -->

This file is the canonical instructions for every agent session. `CLAUDE.md` imports it, and `.github/copilot-instructions.md` points here.

**Read first, in order:** this file, the design docs listed below, then the body of the **Project status** issue (labeled `status`) for what's in flight. If you were given a role (plan, implement, review, fix), also read its file in `docs/agents/`. If you were assigned a task issue (GitHub Copilot, for example), you are the **implementer**.

Design docs: <!-- ADAPT: e.g. `docs/DESIGN.md`, `docs/architecture.md` -->

## Verify every change

```sh
<validate command>    # ADAPT: the one command that must pass, e.g. `npm run validate` or `make check`
```

CI's one required check runs the same command. A step that could not run (a tool missing) is *did not run*, not *passed*; neither is green.

## Rules

<!-- ADAPT: the project's invariants, each one checkable. The reviewer checks
these under "Safety", so write them as things a diff can break. Examples:
- **`src/core/` is pure.** No network or clock access; time comes in as a parameter.
- **Every write goes through `Repository.save()`.** No direct SQL elsewhere.
- **New behaviour gets a test that fails without the change.** Check by reverting once. -->

- **Comments explain why, not what.** Match the surrounding code's style.

## Git and pull requests

- Branch from current `main`. One task issue, one branch, one PR, squash-merged.
- The PR body says `Closes #N` for exactly one issue. Keep it short: what changed, the evidence, anything deliberately not done. The reviewer does not read it, so don't argue for your change there; make the diff and tests speak.
- **Never merge, approve, or enable auto-merge.** A person merges. (`.claude/settings.json` removes those tools.)
- Don't touch files the task doesn't need, and don't reformat files you otherwise left alone.

## Revised

- **<date>:** adopted the ai-devops-cicd small-project template.
