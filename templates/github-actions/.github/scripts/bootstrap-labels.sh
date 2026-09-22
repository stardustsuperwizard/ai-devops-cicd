#!/usr/bin/env bash
# Create every label the agent control plane triggers on.
#
# RUN THIS FIRST. Every trigger in the control plane is keyed on a label NAME,
# and a fresh repository has none of them. Until this script has run, the
# entire pipeline is inert on arrival -- nothing fires, and nothing reports
# why. There is no error to find, because no workflow was ever reached.
#
# The twelve `agent:{role}:{vendor}` labels matter most: they are written by
# HUMANS, so no workflow ever creates them lazily. Delete one and the trigger
# keyed on it silently stops firing until it is added back by hand.
#
# The rest may also be bootstrapped lazily by whichever workflow's
# `ensure_label` guard runs first. Creating them up front costs nothing and
# makes the repository's Labels page readable before the first Issue is filed.
#
# Idempotent: an existing label is updated to the color/description below
# rather than erroring. Safe to re-run after editing this file. Never deletes,
# so a label this script no longer creates survives on a repository that
# already has it.
#
# Colors are cosmetic. Nothing in the control plane reads a label's color
# back -- only its name -- so recoloring any of these is safe.
#
# Usage: .github/scripts/bootstrap-labels.sh [owner/repo]
# Requires `gh` authenticated with repo scope.

set -euo pipefail

repo="${1:-}"
if [ -z "$repo" ]; then
  repo="$(gh repo view --json nameWithOwner -q .nameWithOwner)"
fi

echo "Bootstrapping labels on $repo"

# name|color|description
LABELS=$(cat <<'LABELS'
agent:planner:copilot|1D76DB|Route planning for this Issue to the Copilot planner
agent:planner:anthropic|1D76DB|Route planning for this Issue to Claude Code, billed to the Anthropic Platform API
agent:planner:claude|1D76DB|Route planning for this Issue to Claude Code, billed to the Claude subscription
agent:implementer:copilot|1D76DB|Route implementation to the Copilot implementer
agent:implementer:anthropic|1D76DB|Route implementation to Claude Code, billed to the Anthropic Platform API
agent:implementer:claude|1D76DB|Route implementation to Claude Code, billed to the Claude subscription
agent:reviewer:copilot|1D76DB|Route review to the Copilot reviewer
agent:reviewer:anthropic|1D76DB|Route review to Claude Code, billed to the Anthropic Platform API
agent:reviewer:claude|1D76DB|Route review to Claude Code, billed to the Claude subscription
agent:fixer:copilot|1D76DB|Route the fix cycle to the Copilot fixer
agent:fixer:anthropic|1D76DB|Route the fix cycle to Claude Code, billed to the Anthropic Platform API
agent:fixer:claude|1D76DB|Route the fix cycle to Claude Code, billed to the Claude subscription
# Issue-type labels, declared in .github/ISSUE_TEMPLATE/*.md frontmatter.
# GitHub silently drops a template label that does not exist in the repository,
# so an Issue filed from the Infrastructure template would simply arrive
# without `infrastructure` and nothing would say why. `bug` and `enhancement`
# ship with every new repository; these two do not.
infrastructure|5319E7|Build, CI, tooling, or repository plumbing
dependency|C2E0C6|Dependency addition, removal, or version change
plan|0E8A16|Intake Issue awaiting decomposition into Implementation Tasks
planned|0E8A16|Intake Issue that has been decomposed
implementation|1D76DB|Implementation Task Issue, ready for an implementer
# Model tier, set by the planner per task and read by the implementer
# workflow. A TIER, never a model id -- see docs/rationale/05-model-tiering.md.
model:haiku|C5DEF5|Model tier: work fully determined by the contract
model:sonnet|C5DEF5|Model tier: the default, and the answer when unsure
model:opus|C5DEF5|Model tier: a wrong choice here is expensive to undo
machine|70A8BD|Work an agent session can complete unattended
human-credentials|D4C5F9|Touches paths GITHUB_TOKEN cannot push; needs a human-credentialed session
blocker|B23F00|This Issue blocks another; drives the native dependency relationship
review:pass|0E8A16|Review verdict: accepted
review:fix|D93F0B|Review verdict: bounded correction required on the same branch
review:planning-failure|B60205|Review verdict: the Issue itself was wrong, not the code
review:design-ambiguity|FBCA04|Review verdict: needs a human design decision before proceeding
# Test ratchet. A state marker on a pull request, applied by a human and
# read live by the `test-ratchet` gate; no workflow ever adds or removes
# it. Its presence downgrades a fallen suite or assertion count from a failure
# to a warning.
test-removal-approved|B60205|Human approval for a pull request that lowers the test suite or assertion count
# Red gate. A state marker on a pull request, applied by a human and
# read live by the `red-gate` gate; no workflow ever adds or removes it.
# Its presence downgrades a suite that passed against the merge base from a
# failure to a warning -- the escape hatch for a characterization test, which
# records behaviour that already exists and so is green there on purpose.
characterization-test|FBCA04|Human approval: this pull request's new tests legitimately pass on the merge base
dashboard|5319E7|The control-plane dashboard Issue
dashboard:update|5319E7|Request a dashboard re-render
pipeline-report|5319E7|The pinned weekly pipeline-report Issue
red-main|B23F00|The default branch is red: escalation Issue from the scheduled base-branch run
LABELS
)

created=0
updated=0

while IFS='|' read -r name color description; do
  [ -n "$name" ] || continue

  # The block above is data read by `read`, not shell, so a comment line in it
  # would otherwise be parsed as a label named "# ..." with no color -- which
  # fails `gh label create`, then fails `gh label edit`, and aborts the whole
  # run under `set -e` partway through. Skipping them here keeps the list
  # self-documenting, which matters more as it grows.
  case "$name" in \#*) continue ;; esac

  if gh label create "$name" \
       --repo "$repo" \
       --color "$color" \
       --description "$description" >/dev/null 2>&1; then
    echo "  created  $name"
    created=$((created + 1))
  else
    # Already exists: bring color and description back in sync. A lazily
    # created label drifts from this file the moment either is edited here,
    # because an `ensure_label` guard only checks that the NAME exists --
    # never whether the color or description still match.
    gh label edit "$name" \
      --repo "$repo" \
      --color "$color" \
      --description "$description" >/dev/null
    echo "  updated  $name"
    updated=$((updated + 1))
  fi
done <<< "$LABELS"

echo "Done: $created created, $updated updated."
echo
echo "Note: the agent:{role}:{vendor} labels have no ensure_label guard"
echo "in any workflow. If one is deleted, nothing recreates it and the trigger"
echo "keyed on it silently stops firing. Re-run this script to restore them."
