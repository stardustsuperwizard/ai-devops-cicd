# Platform mapping

The eight primitives from
[`reference-architecture.md`](reference-architecture.md), mapped onto four
concrete stacks. Use this to find out what you get for free and what you have
to build.

## The primitive table

| | GitHub + Actions | **Jira + Jenkins** | GitLab | Azure DevOps |
| --- | --- | --- | --- | --- |
| **P1** Work item | Issue | Jira issue | Issue | Work Item |
| **P2** Hierarchy | Sub-issues | Epic → Story → Sub-task | Epic/child links | Parent/Child link |
| **P3** Dependency | `blocked-by` | "is blocked by" link | "blocked by" link | Predecessor/Successor |
| **P4** Marker | Label | **Label field** (see below) | Label | Tag |
| **P5** Marker event | `issues: [labeled]` | **Webhook `jira:issue_updated`** | Issue webhook | Service hook |
| **P6** Session runner | Composite action | **Jenkins shared-library step** | CI job template | Pipeline template |
| **P7** Change proposal | Pull request | **PR/MR in the SCM**, linked by key | Merge request | Pull Request |
| **P8** Comment | Issue/PR comment | Jira comment | Note | Work Item comment |

Nothing in the middle column is missing. Jira + Jenkins is a complete target.

---

## Jira + Jenkins in detail

This is the port most likely to be asked for, so it gets the full treatment.

### P4 — which Jira field carries the marker

Three candidates. Pick one and never mix them:

| Option | Pros | Cons |
| --- | --- | --- |
| **Labels** (recommended) | Free-form, multi-valued, settable in two taps on mobile, `labels = "x"` in JQL | No per-label permissions |
| **Status transitions** | Auditable; enforces legal orderings | Workflow scheme edits need admin; exploding state count; one status at a time |
| **Custom single-select field** | Validated values | Also needs admin; single-valued, so `blocker` + `agent:reviewer:claude` cannot coexist |

Use **labels**, for exactly the reason GitHub labels work: the trigger surface
has to be reachable from a phone by someone who is not a Jira admin.

Keep the same naming scheme — `agent:planner:claude`, `review:pass`,
`plan`/`planned`, `blocker`, `dashboard:update`. Jira labels **cannot contain
spaces**, which the scheme already satisfies.

Create them by filing one scratch issue and applying each label once (Jira
labels are created on first use, and there is no label-admin API for
project-scoped labels). That scratch issue is the Jira equivalent of
`bootstrap-labels.sh` — **and it is just as mandatory.** Without it the
autocomplete is empty and nothing in the control plane fires.

### P5 — the event path

Jira webhook → Jenkins. Two wiring options:

**Recommended — Jenkins generic webhook trigger:**

```
Jira: Settings → System → WebHooks → Create
  URL:    https://jenkins.example.com/generic-webhook-trigger/invoke?token=<token>
  Events: issue updated, issue created
  JQL:    project = PROJ AND labels IS NOT EMPTY
```

Then in the Jenkinsfile, bind the fields you need out of the payload and
**gate on the label actually being present** — Jira's `issue_updated` fires on
every field change, so the job must filter:

```groovy
properties([
  pipelineTriggers([
    [$class: 'GenericTrigger',
     genericVariables: [
       [key: 'ISSUE_KEY', value: '$.issue.key'],
       [key: 'LABELS',    value: '$.issue.fields.labels'],
       [key: 'EVENT',     value: '$.webhookEvent'],
     ],
     token: env.WEBHOOK_TOKEN,
     // only build when an agent trigger label is present
     regexpFilterText: '$LABELS',
     regexpFilterExpression: '.*agent:reviewer:.*',
     causeString: 'Jira $ISSUE_KEY labelled']
  ])
])
```

**Fallback — polling.** If you cannot expose Jenkins to Jira, poll:

```groovy
triggers { cron('H/10 * * * *') }   // every ~10 minutes
```

…then JQL for `labels in (agent:reviewer:copilot, agent:reviewer:claude)` and
process each hit. Same contract, worse latency. Latency was never a goal — see
[`../concepts/00-overview.md`](../concepts/00-overview.md).

### Jira's `changelog` is how you detect *which* label was added

`jira:issue_updated` carries a `changelog` with `from`/`to` for the labels
field. Diff it rather than reading the current label set, or a job will fire on
an unrelated edit to an issue that happens to still carry a trigger label.

### Consuming the marker (the retry property)

```groovy
def consumeLabel(String key, String label) {
  // Jira has no "remove one label" verb; use the update-verb form.
  httpRequest(
    httpMode: 'PUT',
    url: "${JIRA}/rest/api/3/issue/${key}",
    authentication: 'jira-creds',
    contentType: 'APPLICATION_JSON',
    requestBody: groovy.json.JsonOutput.toJson([
      update: [labels: [[remove: label]]]
    ])
  )
}
```

Use the `update` verb, **never** `fields: [labels: [...]]` — the latter
replaces the whole set and silently drops `blocker`, `review:pass` and
everything else. This is the P5/C5 asymmetry warned about in the reference
architecture, and Jira is where it bites hardest.

### P6 — the session runner as a shared-library step

C3 becomes `vars/runAgentSession.groovy` in a Jenkins shared library. Same
contract as the GitHub composite action, same one-file confinement of vendor
differences:

```groovy
// vars/runAgentSession.groovy
def call(Map args) {
  // args: vendor, promptFile, models, capability, maxTurns, maxCredits
  def (cli, auth) = [
    copilot:   ['copilot', 'copilot'],
    anthropic: ['claude',  'api-key'],
    claude:    ['claude',  'oauth'],
  ][args.vendor] ?: error("Unknown vendor '${args.vendor}'")

  // capability is ONE semantic knob; encode per CLI here and nowhere else.
  def toolFlags = (cli == 'copilot')
    ? (args.capability == 'write'
        ? '--excluded-tools "task,write_agent"'
        : '--excluded-tools "bash,powershell,apply_patch,create,edit,task,write_agent"')
    : (args.capability == 'write'
        ? '--permission-mode dontAsk --allowedTools "Read,Grep,Glob,Edit,Write,Bash"'
        : '--permission-mode dontAsk --allowedTools "Read,Grep,Glob"')

  // …walk args.models in order; advance ONLY on unavailability…
  // …always emit outcome.json, duration, cost, even on total failure…
}
```

Store credentials as Jenkins credentials and bind them per vendor with
`withCredentials`. The credential a failure message names must match the
vendor that failed — see
[`../concepts/08-session-outcomes.md`](../concepts/08-session-outcomes.md).

### P7 — linking Jira to the change proposal

Jira does not host code. Put the **Jira key in the branch name** (`PROJ-123-…`)
and in the commit messages, which is what every Jira/SCM integration keys on.

Then, wherever GitHub's model says "the PR closes the issue", Jira's says "the
PR is linked to the issue and a workflow transition closes it." Keep the link
explicit: the change proposal's description carries the key, and the publisher
transitions the issue rather than relying on a smart-commit that may be
disabled.

### C7 — the control plane on Jira

A Jira dashboard gadget is the board trap all over again — it cannot cause
work, and it stores a second copy of state.

Do the same thing the GitHub side does: a **rendered document**, on demand.
Render the derived states into the description of one dedicated Jira issue
(label it `dashboard`), or into a Confluence page. The derivation is
unchanged; only the write target differs.

JQL for each bucket, so the renderer is mostly one query per row:

```
Awaiting planning:  labels = plan AND statusCategory != Done
Blocked:            issueFunction in linkedIssuesOf("statusCategory != Done", "is blocked by")
Ready to dispatch:  labels = implementation AND statusCategory != Done AND <no linked PR>
Needs attention:    labels in (review:fix, review:planning-failure,
                               review:design-ambiguity, validation:failed)
Ready to merge:     labels = review:pass
```

(`issueFunction` needs ScriptRunner. Without it, fetch the dependency links
per issue and compute the closure in the renderer — which is what the GitHub
renderer does anyway.)

### What Jira gives you that GitHub does not

- **Real dependency link types**, first-class and queryable, where GitHub's
  are newer and thinner.
- **Custom fields** — the model tier can be a validated single-select rather
  than a label convention.
- **Workflow validators** — you can genuinely forbid a transition to *In
  Review* without acceptance criteria, which on GitHub is a check that can be
  merged past.

Use the third one. A Jira workflow validator that refuses to let a task reach
dispatchable state without non-empty acceptance criteria enforces the
cold-start test from
[`../concepts/03-handoff-contract.md`](../concepts/03-handoff-contract.md)
structurally, which is strictly better than validating it in the planner.

### What Jenkins gives you that Actions does not

- **A real credential store** with per-job scoping.
- **Agents/nodes you control** — a session runner that needs a GPU, a licence
  server, or an engine binary does not have to reinstall it every run.
- **`stash`/`unstash` and durable workspaces**, so a merge-base checkout for
  the red gate is cheap.

### What you lose, and must rebuild

| Lost | Rebuild as |
| --- | --- |
| Fork-safe read-only tokens | Explicit least-privilege Jenkins credentials per job |
| `GITHUB_TOKEN` "setup: none" | A service account, with its own Jira permission scheme |
| Draft proposal state | A `wip` label on the issue, or the SCM's own draft flag |
| Checks UI on the diff | Post gate reports as SCM comments; keep the run summary as the record |
| Sub-issue auto-linking | Explicit parent link written by the publisher |

---

## GitLab notes

Nearly one-to-one with GitHub. Three differences worth planning for:

- **CI is `.gitlab-ci.yml` with `include:` templates.** C3 becomes a job
  template with `extends:`, which is closer to a reusable workflow than to a
  composite action — variables, not inputs.
- **Label events** are available via webhooks and, in newer versions, as
  pipeline triggers; check your version rather than assuming.
- **Merge request approval rules** are stronger than GitHub's, so gate 6
  (human-decision boundaries) can be enforced by an approval rule instead of a
  convention.

## Azure DevOps notes

- Work Item **tags** are the marker primitive; service hooks are the event.
- Pipeline **templates** with `parameters:` map cleanly onto C3's inputs —
  arguably more cleanly than composite actions, since parameters are typed.
- The work-item **Rules** engine can enforce the acceptance-criteria
  precondition the same way a Jira validator can.

## Porting checklist

Work in this order; each step is verifiable before the next.

1. [ ] Map all eight primitives. Name the degradation for any you lack.
2. [ ] Create the marker vocabulary, and prove a human can set one from a
       phone in two taps.
3. [ ] Wire **one** marker to **one** job that does nothing but echo the item
       key. Do not proceed until a label add reliably produces a run.
4. [ ] Build C3, the session runner, with **one** vendor. Prove the capability
       knob works in both postures by asserting a read-only session cannot
       write a file.
5. [ ] Add the second vendor. Nothing above C3 may change. If something did,
       the abstraction is wrong.
6. [ ] Build the **reviewer** role end to end — it is read-only, so it cannot
       damage anything, and it exercises C2 through C5 completely.
7. [ ] Add the implementer. This is where write capability, branches and
       proposals arrive.
8. [ ] Add the planner, with **structural validation of its output** before
       any item is created.
9. [ ] Add the fixer and the escalation cap.
10. [ ] Add quality gates.
11. [ ] Add the control-plane renderer last — it derives from everything above.

Step 6 before step 7 is deliberate: build the role that cannot break anything
first.
