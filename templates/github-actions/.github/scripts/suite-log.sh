#!/usr/bin/env bash
# TOOLCHAIN ADAPTER — 4 of 4. This file is meant to be rewritten.
#
# Runs the test suite against an OVERLAY of two trees and captures the log.
# Used only by the red gate (RULES.md GAT-1), and it is the one adapter
# whose semantics are easy to get subtly and expensively wrong.
#
# ── What an overlay is, and why it is not just "check out the old code" ──
#
# The red gate asks: *would this change's new tests have failed before the
# change?* Answering it needs a tree that is
#
#     the merge base's PRODUCTION code  +  this change's TEST code
#
# Not the merge base alone — the new tests do not exist there, so nothing
# runs and the gate proves nothing. Not the head alone — that is just the
# suite passing, which another job already established.
#
# So: check out the merge base, then copy the head's test files over it.
# The tests are new; the code they test is old. If a test passes in that
# tree, it was asserting something that was already true.
#
# ── The contract ─────────────────────────────────────────────────────────
#
#   --merge-base <sha>     the commit to overlay onto
#   --scratch <dir>        working directory, OUTSIDE the checkout
#   --head-root <dir>      the head checkout, to copy test files from
#   --log <path>           where to write the captured suite output
#
#   exit 0   the suite ran and the log was written — WHATEVER the suite's
#            own result was. A red suite is the EXPECTED outcome here.
#   exit ≠0  the suite could not be run at all
#
# That exit convention is the part to get right. This script reports
# *whether it could run*, never *whether the suite passed*. `red-gate.py`
# reads the log and decides the verdict. Conflating the two turns "the
# gate is broken" into "the change is fine", which is GAT-4 and the reason
# a broken gate can fail open for months without anyone noticing.
#
# ── Adapting it ──────────────────────────────────────────────────────────
#
# Replace the two TODO sections. Everything else is the overlay mechanics
# and is language-independent.
#
# Two things that are not optional:
#
#   * Scratch lives OUTSIDE the checkout. A second checkout inside the tree
#     gets picked up by test discovery, by the formatter, and by the agent
#     session's own file walk. Use `git worktree add --detach` into a temp
#     directory.
#   * The log is the artifact. Write everything the suite emits, verbatim.
#     `red-gate.py` matches whole lines against a registered set of suite
#     names — it does not tolerate a summarized or filtered log.

set -euo pipefail

MERGE_BASE="" ; SCRATCH="" ; HEAD_ROOT="" ; LOG=""
while [ $# -gt 0 ]; do
  case "$1" in
    --merge-base) MERGE_BASE="$2"; shift 2 ;;
    --scratch)    SCRATCH="$2";    shift 2 ;;
    --head-root)  HEAD_ROOT="$2";  shift 2 ;;
    --log)        LOG="$2";        shift 2 ;;
    *) echo "suite-log: unknown argument '$1'" >&2; exit 2 ;;
  esac
done

for v in MERGE_BASE SCRATCH HEAD_ROOT LOG; do
  if [ -z "${!v}" ]; then
    echo "suite-log: --${v,,} is required" >&2
    exit 2
  fi
done

mkdir -p "$(dirname "$LOG")"

# ── 1. The merge base, in a detached worktree outside the checkout ───────
rm -rf "$SCRATCH"
git worktree add --detach "$SCRATCH" "$MERGE_BASE" >&2

cleanup() { git worktree remove --force "$SCRATCH" >/dev/null 2>&1 || true; }
trap cleanup EXIT

# ── 2. Overlay the head's tests onto it ──────────────────────────────────
#
# TODO: copy YOUR test paths from "$HEAD_ROOT" into "$SCRATCH", replacing
# whatever is there. These must be the same directories `count-tests.py`
# scans and `red-gate.py` treats as test paths — three different answers to
# "what is a test file?" is how this gate starts lying.
#
# TEST_DIRS=(tests)
# for d in "${TEST_DIRS[@]}"; do
#   rm -rf "${SCRATCH:?}/$d"
#   [ -d "$HEAD_ROOT/$d" ] && cp -a "$HEAD_ROOT/$d" "$SCRATCH/$d"
# done
echo "suite-log: overlay step has not been adapted for this project." >&2
echo "Edit .github/scripts/suite-log.sh." >&2
exit 2

# ── 3. Run the suite against the overlay, capturing everything ───────────
#
# TODO: your suite command, rooted at "$SCRATCH". Note the `|| true`: a red
# suite here is the expected outcome, not a failure of this script.
#
# ( cd "$SCRATCH" && <your suite command> ) > "$LOG" 2>&1 || true
#
# echo "suite-log: wrote $(wc -l < "$LOG") lines to $LOG" >&2
