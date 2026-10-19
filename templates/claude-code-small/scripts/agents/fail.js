// Last step of every agent workflow job, run only when an earlier step
// failed. Without it, a crash before the verdict leaves the PR or issue with
// its trigger label consumed and nothing else: no comment, no status. A gate
// that didn't run must say so (ai-devops-cicd GAT-4, INT-5).
//
// Steps that fail on purpose after explaining themselves (a refused trigger,
// an invalid plan) call markReported(), and this script then stays quiet.
//
//   node scripts/agents/fail.js --issue 54 --retry run:review --run-url <url> [--sha <head sha>]

import { existsSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { github } from './github.js';

const MARKER = 'agent-failure-reported';

/** Record that this job has already told people why it failed. */
export function markReported() {
  if (process.env.RUNNER_TEMP) writeFileSync(join(process.env.RUNNER_TEMP, MARKER), '');
}

function arg(name) {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function main() {
  const number = Number(arg('issue'));
  const retry = arg('retry');
  const runUrl = arg('run-url');
  const sha = arg('sha');
  if (process.env.RUNNER_TEMP && existsSync(join(process.env.RUNNER_TEMP, MARKER))) {
    console.log('An earlier step already reported this failure.');
    return;
  }
  const gh = github();
  await gh.comment(
    number,
    `**The \`${retry}\` workflow failed before it finished, so nothing was published.** This is a fault in the workflow, not a verdict on the work. See the [run log](${runUrl}). Add \`${retry}\` again to retry once it's fixed.`,
  );
  if (sha) {
    await gh.request('POST', `${gh.repoPath}/statuses/${sha}`, {
      context: 'review',
      state: 'error',
      description: 'The review workflow failed before a verdict. See the PR comment.',
      target_url: runUrl,
    });
  }
}

if (import.meta.url === `file://${process.argv[1]}`) await main();
