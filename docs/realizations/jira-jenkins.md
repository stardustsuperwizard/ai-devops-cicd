# Realization: Jira + Jenkins

The architecture on a tracker that is not GitHub and a runner that is not
Actions. Nothing is missing here; Jira + Jenkins is a complete target, and in
one respect ([workflow validators](#what-jira-gives-you-that-a-thinner-tracker-does-not)) a better one.

Component letters (**C1**–**C7**) refer to
[`../architecture/01-components.md`](../architecture/01-components.md);
capability letters (**S1**–**S8**) to
[`../architecture/02-substrate.md`](../architecture/02-substrate.md); rule IDs
to [`../../RULES.md`](../../RULES.md).

Read [tier 0](../architecture/02-substrate.md#tier-0--the-minimal-realization)
first if you have not. This page is that script with Jira's nouns.

## S4 — which Jira field carries the marker

Three candidates. Pick one and never mix them:

| Option | Pros | Cons |
| --- | --- | --- |
| **Labels** (recommended) | Free-form, multi-valued, settable in two taps on mobile, `labels = "x"` in JQL | No per-label permissions |
| **Status transitions** | Auditable; enforces legal orderings | Workflow scheme edits need admin; exploding state count; one status at a time |
| **Custom single-select field** | Validated values | Also needs admin; single-valued, so `blocker` + `agent:reviewer:claude` cannot coexist |

Use **labels**, for the reason **DSP-1** gives: the trigger surface has to be
reachable from a phone by someone who is not a Jira admin. The multi-valued
requirement is the other half — `blocked`, a tier and a trigger must coexist
on one issue, which a status field cannot do.

Keep the same naming scheme — `agent:planner:claude`, `review:pass`,
`plan`/`planned`, `blocker`, `dashboard:update`. Jira labels **cannot contain
spaces**, which the scheme already satisfies.

Create them by filing one scratch issue and applying each label once (Jira
labels are created on first use, and there is no label-admin API for
project-scoped labels). That scratch issue is the Jira equivalent of
the bootstrap script **DSP-8** requires — **and it is just as mandatory.** Without it the
autocomplete is empty and nothing in the control plane fires.

## S5 / C1 — the event path

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
process each hit. Same contract, worse latency — which
the architecture explicitly does not optimise for (**DSP-1** cares that
dispatch is possible, not that it is fast).

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
everything else. This is rule **DSP-9**, and Jira is where it bites hardest.

## S6 / C3 — the session runner as a shared-library step

C3 becomes `vars/runAgentSession.groovy` in a Jenkins shared library. Same contract as any other
realization of C3, same one-file confinement of runtime differences (**SES-1**):

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
[`../rationale/08-session-outcomes.md`](../rationale/08-session-outcomes.md).

## S7 — linking Jira to the change proposal

Jira does not host code. Put the **Jira key in the branch name** (`PROJ-123-…`)
and in the commit messages, which is what every Jira/SCM integration keys on.

So where a tracker that hosts code says "the proposal closes the item", Jira
says "the proposal is linked to the item and a workflow transition closes it." Keep the link
explicit: the change proposal's description carries the key, and the publisher
transitions the issue rather than relying on a smart-commit that may be
disabled.

## C7 — the control plane on Jira

A Jira dashboard gadget is the stored-state trap (**OBS-1**): it cannot cause
work, and it keeps a second copy of facts Jira already holds.

Do what C7 requires on any substrate: a **rendered document**, on demand.
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
per issue and compute the closure in the renderer, which is what C7 does
anyway.)

## What Jira gives you that a thinner tracker does not

- **Real dependency link types**, first-class and queryable — S3 natively,
  where thinner trackers need the body-table degradation.
- **Custom fields** — the model tier can be a validated single-select rather
  than a label convention.
- **Workflow validators** — you can genuinely forbid a transition to *In
  Review* without acceptance criteria — where a status check can be merged
  past.

Use the third one. A validator that refuses to let a task reach dispatchable
state without non-empty acceptance criteria enforces **HND-3**, the cold-start
test, *structurally* — strictly better than validating it inside the planner,
because it cannot be argued with. Where a substrate can make a rule impossible
to break, prefer that over checking it.

## What Jenkins gives you

- **A real credential store** with per-job scoping.
- **Agents/nodes you control** — a session runner that needs a GPU, a licence
  server, or an engine binary does not have to reinstall it every run.
- **`stash`/`unstash` and durable workspaces**, so a merge-base checkout for
  the red gate is cheap.

## What you must rebuild

| Absent | Rebuild as |
| --- | --- |
| Fork-safe read-only tokens (**GAT-7**) | Explicit least-privilege Jenkins credentials per job |
| A zero-setup automation identity | A service account, with its own Jira permission scheme |
| Draft proposal state (**GAT-10**) | A `wip` label on the issue, or the SCM's own draft flag |
| Checks UI on the diff | Post gate reports as SCM comments; keep the run summary as the record |
| Sub-item auto-linking | Explicit parent link written by C5 |

---

## Conformance notes for this realization

Run the self-assessment in
[`../architecture/04-conformance.md`](../architecture/04-conformance.md).
Three checks deserve extra care on this substrate:

- **DSP-9 (marker writes add, not replace).** Jira's `fields:` form replaces
  the whole label set. Use the `update:` verb, every time. This is the single
  most likely silent data loss here.
- **DSP-1 (dispatch from any client).** Verify on the Jira mobile app, as a
  user without project-admin rights. If your marker primitive turned out to be
  a status transition or a custom field, this is where you find out.
- **SES-1 (runtime differences in one place).** The shared library is that
  place. A `if (vendor == …)` in a Jenkinsfile means the seam has leaked.

## Where this came from

Nothing on this page is theoretical wiring — but it has not been run end to
end as a whole. The component contracts and rules it realizes are from a
production system; the Jira and Jenkins specifics are the translation. Treat
the code fragments as shape, and verify against your own versions, which
differ more than the vendors' docs admit.
