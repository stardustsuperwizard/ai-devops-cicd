#!/usr/bin/env bash
# TOOLCHAIN ADAPTER — 1 of 4. This file is meant to be rewritten.
#
# The single definition of "is this checkout green?". Everything in the
# control plane that needs to know calls THIS, never your tools directly:
# the implementer runs it before marking a pull request ready, the fixer runs
# it after a correction, the review request quotes its output, and the CI
# gate wraps it.
#
# That indirection is the whole reason ~90% of this control plane is
# language-agnostic. Twenty-odd files reference `project-validate.sh`; none
# of them reference your compiler. Draw this boundary on day one —
# retrofitting it into workflows that shell out to your build tool inline is
# a rewrite, not an edit.
#
# ── The contract ─────────────────────────────────────────────────────────
#
#   exit 0    the checkout is green
#   exit 1    the checkout is not green
#   exit 127  the toolchain is not installed (see below — this is distinct)
#
#   stdout/stderr   human-readable; it is captured verbatim, quoted into
#                   pull request bodies and review prompts, and truncated
#                   from the FRONT by callers. Put the summary last.
#
# Exit 127 is separate on purpose. "The tests failed" and "nothing ran"
# are different facts, and a caller that conflates them reports a red build
# when what actually happened is that a setup step was skipped. This is the
# same distinction the quality gates draw between *wrong* and *could not
# decide* — see RULES.md GAT-4.
#
# ── What belongs in here ─────────────────────────────────────────────────
#
# Everything a contributor would run locally before pushing, in the order a
# fast feedback loop wants: cheapest and most likely to fail first.
#
#   typecheck / compile     →  test run      →  anything slower
#
# What does NOT belong: formatting (that is adapter 2, and it is applied
# rather than checked), packaging, deployment, or anything needing a
# credential. This script must run on a read-only checkout with no secrets,
# because gates invoke it on contributions from outside your trust boundary.
#
# ── Adapting it ──────────────────────────────────────────────────────────
#
# Replace the body below. Keep: the three exit codes, the `command -v` guard,
# and `set -uo pipefail` without `-e` (the script decides its own exit code;
# `-e` would abort before the summary is printed).

set -uo pipefail

# TODO: the executable that must exist for anything here to mean anything.
TOOLCHAIN_BIN="${TOOLCHAIN_BIN:-<your-build-tool>}"

if ! command -v "$TOOLCHAIN_BIN" >/dev/null 2>&1; then
  echo "project-validate: '$TOOLCHAIN_BIN' not found on PATH." >&2
  echo "Nothing was validated. This is NOT a failing build — it is a" >&2
  echo "missing setup step. The caller should have run the" >&2
  echo "setup-toolchain action first." >&2
  exit 127
fi

status=0

# ── 1. Typecheck / compile ───────────────────────────────────────────────
# TODO: your equivalent. Fast, and catches the most.
echo "== typecheck =="
# "$TOOLCHAIN_BIN" check || status=1

# ── 2. Tests ─────────────────────────────────────────────────────────────
# TODO: your equivalent. Must be non-interactive and must not need network
# or credentials.
echo "== tests =="
# "$TOOLCHAIN_BIN" test || status=1

# ── Summary, last, because callers truncate from the front ───────────────
echo
if [ "$status" -eq 0 ]; then
  echo "project-validate: PASS"
else
  echo "project-validate: FAIL"
fi

exit "$status"
