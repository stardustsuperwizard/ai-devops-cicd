// Review stage driver for .github/workflows/agent-review.yml.
//
//   review.js prepare --pr 42 --pr-dir .review-pr --out <dir>
//     Fetches exactly the reviewer's inputs and writes <dir>/prompt.md and
//     <dir>/context.json. Prints run=true|false for the workflow.
//   review.js publish --out <dir> --session-dir <dir> --model m --effort e
//     Classifies the session, extracts the verdict, and publishes the
//     comment, the review:* label and the `review` commit status.
//
// Sessions never publish: they hold no GitHub credential. This script does,
// and runs before and after the session, never during it (ai-devops-cicd SEC-3).

import { readFileSync, writeFileSync, mkdirSync, existsSync, appendFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { github, ownerComments } from './github.js';
import { classifyOutcome, sessionMarker } from './outcome.js';
import { loadConfig } from './config.js';
import {
  buildReviewPrompt,
  extractReviewVerdict,
  countPriorFixes,
  applyCap,
  reviewStatus,
  renderPrReview,
  summarizeImplementerSessions,
  copilotTimeoutMinutes,
  VERDICT_LABELS,
  VERDICT_MARKER,
} from './review-lib.js';

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : fallback;
}

function output(key, value) {
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `${key}=${value}\n`);
  console.log(`${key}=${value}`);
}

const git = (...args) => execFileSync('git', args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }).trim();

async function linkedIssue(gh, number) {
  const data = await gh.graphql(
    `query($owner: String!, $repo: String!, $number: Int!) {
      repository(owner: $owner, name: $repo) {
        pullRequest(number: $number) { closingIssuesReferences(first: 5) { nodes { number } } }
      }
    }`,
    { owner: gh.owner, repo: gh.repo, number },
  );
  return data.repository.pullRequest.closingIssuesReferences.nodes.map((n) => n.number);
}

/**
 * Copilot sessions on the PR's branch, timed from GitHub's run records. Each
 * is judged against the limit in force when it ran: the setup-steps file at
 * the commit the session started from, or main's if that isn't available.
 * Best effort: this is evidence for the reviewer, not a gate.
 */
async function implementerSessions(gh, headRef) {
  try {
    const { workflow_runs: runs } = await gh.request('GET', `${gh.repoPath}/actions/runs?branch=${encodeURIComponent(headRef)}&per_page=100`);
    const file = '.github/workflows/copilot-setup-steps.yml';
    const limitAt = (sha) => {
      try {
        return copilotTimeoutMinutes(git('show', `${sha}:${file}`));
      } catch {
        return existsSync(file) ? copilotTimeoutMinutes(readFileSync(file, 'utf8')) : null;
      }
    };
    return summarizeImplementerSessions(runs ?? [], (run) => limitAt(run.head_sha));
  } catch (err) {
    console.warn(`Could not read implementer sessions: ${err.message}`);
    return { sessions: [], totalMs: 0, anyNearLimit: false, error: err.message };
  }
}

async function prepare() {
  const number = Number(arg('pr'));
  const prDir = arg('pr-dir', '.review-pr');
  const out = arg('out');
  mkdirSync(out, { recursive: true });
  const gh = github();

  // Only the fields the reviewer is allowed to see (CTX-2). Notably not pr.body.
  const raw = await gh.request('GET', `${gh.repoPath}/pulls/${number}`);
  const pr = { number, headSha: raw.head.sha, baseRef: raw.base.ref, sameRepo: raw.head.repo?.full_name === raw.base.repo.full_name, author: raw.user?.login ?? '', headRef: raw.head.ref };
  const prior = (await gh.comments(number)).filter((c) => c.user?.type === 'Bot').map((c) => c.body ?? '');
  const priorFixes = countPriorFixes(prior);
  const context = { pr, priorFixes, task: null, skip: null };

  if (!pr.sameRepo) context.skip = { reason: 'This workflow only reviews branches in this repository, not forks.' };

  const linked = await linkedIssue(gh, number);
  if (!context.skip && linked.length !== 1) {
    // Deterministic, so no session is spent on it (GAT-9).
    context.skip = {
      verdict: 'PLANNING FAILURE',
      reason: linked.length
        ? `The PR closes ${linked.length} issues (${linked.map((n) => `#${n}`).join(', ')}); a PR must close exactly one task issue.`
        : 'The PR is not linked to a task issue. Add `Closes #N` for the task it implements.',
    };
  }

  if (!context.skip) {
    const issue = await gh.request('GET', `${gh.repoPath}/issues/${linked[0]}`);
    context.task = {
      number: issue.number,
      title: issue.title,
      body: issue.body ?? '',
      ownerComments: ownerComments(await gh.comments(issue.number), gh.owner),
    };
    // The workflow's full-history checkout already has origin/<base>, and it
    // fetched the PR head as pr/head; this step holds no git credentials.
    pr.mergeBase = git('merge-base', `origin/${pr.baseRef}`, pr.headSha);
    const diff = git('diff', '--no-color', pr.mergeBase, pr.headSha);
    const diffStat = git('diff', '--stat', '--no-color', pr.mergeBase, pr.headSha);
    const runs = await gh.request('GET', `${gh.repoPath}/commits/${pr.headSha}/check-runs?per_page=100`);
    const checks = runs.check_runs.map((r) => ({ name: r.name, status: r.status, conclusion: r.conclusion }));
    context.implementer = await implementerSessions(gh, pr.headRef);
    const roleDoc = readFileSync('docs/agents/reviewer.md', 'utf8');
    writeFileSync(
      join(out, 'prompt.md'),
      buildReviewPrompt({ roleDoc, pr, task: context.task, diff, diffStat, checks, priorFixes, prFilesDir: prDir, implementer: context.implementer }),
    );
  }
  writeFileSync(join(out, 'context.json'), JSON.stringify(context, null, 2));
  output('run', context.skip ? 'false' : 'true');
  output('head_sha', pr.headSha);
}

function readEvidence(sessionDir) {
  const read = (f) => (existsSync(join(sessionDir, f)) ? readFileSync(join(sessionDir, f), 'utf8') : '');
  const ranFile = read('ran').trim();
  return {
    ran: ranFile === 'true',
    notRunReason: ranFile === 'true' ? '' : read('not-run-reason').trim() || 'The session step did not run.',
    exitCode: Number(read('exit-code').trim() || 0),
    stdout: read('envelope.json'),
    stderr: read('stderr.log'),
    treeModified: read('tree-modified').trim() === 'true',
  };
}

async function publish() {
  const out = arg('out');
  const sessionDir = arg('session-dir');
  const model = arg('model', '');
  const effort = arg('effort', '');
  const context = JSON.parse(readFileSync(join(out, 'context.json'), 'utf8'));
  const { pr, priorFixes } = context;
  const gh = github();

  let verdict = null;
  let body;
  let marker = '';
  if (context.skip?.verdict) {
    verdict = context.skip.verdict;
    body = `VERDICT: ${verdict}\n\n## Acceptance criteria\n- Not reviewed: ${context.skip.reason}\n\n## Scope\nNot reviewed.\n\n## Safety\nNot reviewed.\n\n## Required before merge\n1. ${context.skip.reason}`;
  } else if (context.skip) {
    body = `The review did not run. ${context.skip.reason}`;
  } else {
    const session = classifyOutcome(readEvidence(sessionDir));
    marker = sessionMarker({ role: 'review', model, effort, ...session, round: priorFixes + 1, implementer: context.implementer });
    const extracted = extractReviewVerdict(session.result, session.outcome);
    if (extracted.ok) {
      const capped = applyCap(extracted.verdict, priorFixes);
      verdict = capped.verdict;
      body = capped.capped
        ? `${extracted.body.replace(/^VERDICT:.*$/m, 'VERDICT: DESIGN AMBIGUITY')}\n\n> The reviewer asked for another fix, but this PR has already had ${priorFixes} FIX rounds, the cap. The owner decides what happens next: rewrite the task, give guidance, or close the PR.`
        : extracted.body;
      if (extracted.needsHumanCheck) await gh.addLabels(pr.number, [loadConfig().humanCheckLabel]);
    } else {
      const why = session.outcome === 'not_run' ? session.reason : `${extracted.reason} ${session.outcome === 'completed' ? '' : session.reason}`.trim();
      body = `**The review did not produce a valid verdict, so nothing was published.** ${why}\n\nAdd \`run:review\` again to retry.`;
    }
  }

  const posted = await gh.comment(pr.number, `${body}\n\n<!-- ${VERDICT_MARKER} ${verdict ?? 'none'} -->${marker ? `\n${marker}` : ''}`);
  if (verdict) {
    // Best effort: the comment, label and status are the verdict; this only mirrors it.
    try {
      const review = renderPrReview({ verdict, commentUrl: posted?.html_url, prAuthor: pr.author });
      await gh.request('POST', `${gh.repoPath}/pulls/${pr.number}/reviews`, { commit_id: pr.headSha, ...review });
    } catch (err) {
      console.warn(`Could not post the PR review: ${err.message}`);
    }
    // Exactly one verdict label: clear the others, then add (DSP-5, DSP-9).
    for (const [v, label] of Object.entries(VERDICT_LABELS)) if (v !== verdict) await gh.removeLabel(pr.number, label);
    await gh.addLabels(pr.number, [VERDICT_LABELS[verdict]]);
  }
  const status = reviewStatus(verdict);
  await gh.request('POST', `${gh.repoPath}/statuses/${pr.headSha}`, { context: 'review', ...status });
  console.log(`Published: ${verdict ?? 'no verdict'} (${status.state}).`);
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `### Review of #${pr.number}\n\n${verdict ?? 'No valid verdict'}: ${status.description}\n`);
}

const command = process.argv[2];
if (command === 'prepare') await prepare();
else if (command === 'publish') await publish();
else {
  console.error('Usage: review.js prepare|publish …');
  process.exit(2);
}
