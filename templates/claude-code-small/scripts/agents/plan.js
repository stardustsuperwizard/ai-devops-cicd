// Planner stage driver for .github/workflows/agent-plan.yml.
//
//   plan.js prepare --issue 26 --out <dir>
//     Writes <dir>/prompt.md from the issue body and the owner's comments.
//   plan.js publish --issue 26 --session-dir <dir> --model m --effort e
//     Validates the session's plan. A valid plan is posted for approval with
//     the plan:proposed label; an invalid one is reported and nothing is
//     created (ai-devops-cicd HND-4).
//   plan.js approve --issue 26
//     Creates the task issues from the latest proposed plan. No model runs.

import { readFileSync, writeFileSync, mkdirSync, existsSync, appendFileSync } from 'node:fs';
import { join } from 'node:path';
import { github, ownerComments } from './github.js';
import { classifyOutcome, sessionMarker } from './outcome.js';
import { loadConfig } from './config.js';
import {
  buildPlanPrompt,
  extractPlan,
  validatePlan,
  renderPlanComment,
  renderTaskBody,
  topoOrder,
  decodePlanMarker,
  PLAN_MARKER,
  CREATED_MARKER,
} from './plan-lib.js';

const APPROVE_LABEL = 'run:plan-approve';
const config = loadConfig();

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : fallback;
}

async function loadIssue(gh, number) {
  const issue = await gh.request('GET', `${gh.repoPath}/issues/${number}`);
  if (issue.pull_request) throw new Error(`#${number} is a pull request, not an issue.`);
  return issue;
}

function issueChecker(gh) {
  const cache = new Map();
  return async (n) => {
    if (!cache.has(n)) {
      try {
        await gh.request('GET', `${gh.repoPath}/issues/${n}`);
        cache.set(n, true);
      } catch {
        cache.set(n, false);
      }
    }
    return cache.get(n);
  };
}

/** validatePlan takes a synchronous lookup, so resolve every #n reference first. */
async function validateWithLookups(gh, plan) {
  const refs = new Set();
  for (const t of Array.isArray(plan?.tasks) ? plan.tasks : []) {
    for (const d of Array.isArray(t?.dependsOn) ? t.dependsOn : []) if (/^#\d+$/.test(d)) refs.add(Number(d.slice(1)));
  }
  const exists = issueChecker(gh);
  const known = new Map();
  for (const n of refs) known.set(n, await exists(n));
  return validatePlan(plan, { issueExists: (n) => known.get(n) === true, areas: config.areas });
}

async function prepare() {
  const number = Number(arg('issue'));
  const out = arg('out');
  mkdirSync(out, { recursive: true });
  const gh = github();
  const issue = await loadIssue(gh, number);
  const roleDoc = readFileSync('docs/agents/planner.md', 'utf8');
  const prompt = buildPlanPrompt({
    roleDoc,
    areas: config.areas,
    issue: { number, title: issue.title, body: issue.body ?? '', ownerComments: ownerComments(await gh.comments(number), gh.owner) },
  });
  writeFileSync(join(out, 'prompt.md'), prompt);
  console.log(`Prompt written for #${number}.`);
}

function readEvidence(sessionDir) {
  const read = (f) => (existsSync(join(sessionDir, f)) ? readFileSync(join(sessionDir, f), 'utf8') : '');
  const ran = read('ran').trim() === 'true';
  return {
    ran,
    notRunReason: ran ? '' : read('not-run-reason').trim() || 'The session step did not run.',
    exitCode: Number(read('exit-code').trim() || 0),
    stdout: read('envelope.json'),
    stderr: read('stderr.log'),
    treeModified: read('tree-modified').trim() === 'true',
  };
}

async function publish() {
  const number = Number(arg('issue'));
  const gh = github();
  const session = classifyOutcome(readEvidence(arg('session-dir')));
  const marker = sessionMarker({ role: 'plan', model: arg('model', ''), effort: arg('effort', ''), ...session });

  const extracted = extractPlan(session.result, session.outcome);
  if (!extracted.ok) {
    const why = session.outcome === 'completed' ? '' : ` ${session.reason}`;
    await gh.comment(number, `**The planner did not produce a usable plan, so nothing was created.** ${extracted.errors.join(' ')}${why}\n\nAdd \`run:plan\` again to retry.\n\n${marker}`);
    process.exitCode = 1;
    return;
  }
  const plan = extracted.plan;
  const result = await validateWithLookups(gh, plan);
  if (!result.ok) {
    const list = result.errors.map((e) => `- ${e}`).join('\n');
    await gh.comment(number, `**The plan failed validation, so nothing was created.**\n\n${list}\n\nComment with guidance if needed, then add \`run:plan\` again.\n\n${marker}`);
    process.exitCode = 1;
    return;
  }
  if (result.blocked) {
    const questions = result.questions.map((q) => `- [ ] ${q}`).join('\n');
    const lead = plan.decision === 'not-ticket-work' ? '**This doesn\'t look like ticket work yet.**' : '**The planner needs decisions before it can split this.**';
    await gh.comment(number, `${lead} ${plan.summary}\n\n${plan.reason ?? ''}\n\n${questions}\n\nAnswer in a comment, then add \`run:plan\` again.\n\n${marker}`);
    await gh.addLabels(number, ['plan:needs-decision']);
    return;
  }
  await gh.comment(number, `${renderPlanComment(plan, { approveLabel: APPROVE_LABEL, sourceIssue: number })}\n${marker}`);
  await gh.addLabels(number, ['plan:proposed']);
  console.log(`Proposed ${plan.tasks.length} task(s) on #${number}.`);
}

async function approve() {
  const number = Number(arg('issue'));
  const gh = github();
  const comments = await gh.comments(number);
  if (comments.some((c) => c.user?.type === 'Bot' && (c.body ?? '').includes(`<!-- ${CREATED_MARKER}`))) {
    await gh.comment(number, `Task issues were already created from this issue's plan, so \`${APPROVE_LABEL}\` did nothing. To plan again, add \`run:plan\`.`);
    return;
  }
  // Only plans this workflow posted count; a pasted marker from anyone else is ignored.
  const latest = comments.filter((c) => c.user?.type === 'Bot' && (c.body ?? '').includes(`<!-- ${PLAN_MARKER} `)).at(-1);
  const plan = latest ? decodePlanMarker(latest.body) : null;
  if (!plan) {
    await gh.comment(number, `There's no proposed plan on this issue to approve. Add \`run:plan\` first.`);
    process.exitCode = 1;
    return;
  }
  const result = await validateWithLookups(gh, plan);
  if (!result.ok || result.blocked) {
    await gh.comment(number, `The proposed plan no longer validates, so nothing was created:\n\n${result.errors.map((e) => `- ${e}`).join('\n')}`);
    process.exitCode = 1;
    return;
  }

  const issueNumbers = new Map();
  const created = [];
  for (const task of topoOrder(plan.tasks)) {
    const issue = await gh.request('POST', `${gh.repoPath}/issues`, {
      title: task.title,
      body: `${renderTaskBody(task, { sourceIssue: number, issueNumbers })}\n---\n_Created by the planner workflow from #${number}._`,
      labels: [task.area, 'agent-ready'],
    });
    issueNumbers.set(task.id, issue.number);
    created.push({ id: task.id, number: issue.number, title: task.title });
    try {
      await gh.request('POST', `${gh.repoPath}/issues/${number}/sub_issues`, { sub_issue_id: issue.id });
    } catch (err) {
      console.warn(`Could not link #${issue.number} as a sub-issue: ${err.message}`);
    }
  }
  const list = created.map((c) => `- [ ] #${c.number} (${c.id}) ${c.title}`).join('\n');
  await gh.comment(number, `Created ${created.length} task issue(s), labeled \`agent-ready\`:\n\n${list}\n\n<!-- ${CREATED_MARKER} -->`);
  await gh.removeLabel(number, 'plan:proposed');
  await gh.addLabels(number, ['planned']);
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `### Plan for #${number}\n\n${list}\n`);
}

const command = process.argv[2];
if (command === 'prepare') await prepare();
else if (command === 'publish') await publish();
else if (command === 'approve') await approve();
else {
  console.error('Usage: plan.js prepare|publish|approve …');
  process.exit(2);
}
