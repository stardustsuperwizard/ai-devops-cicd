// Consume a trigger label, then check the person who set it may spend a
// session. Consuming first means re-adding the label is always a clean retry
// (ai-devops-cicd DSP-2), even when the run fails later. Label changes made
// with the Actions token don't start workflows, so nothing here can loop (DSP-7).
//
//   node scripts/agents/trigger.js --label run:review --issue 42 --sender octocat

import { github } from './github.js';

const ALLOWED = new Set(['admin', 'maintain', 'write']);

function arg(name) {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

const label = arg('label');
const number = Number(arg('issue'));
const sender = arg('sender');
if (!label || !number || !sender) {
  console.error('Usage: trigger.js --label <name> --issue <number> --sender <login>');
  process.exit(2);
}

const gh = github();
await gh.removeLabel(number, label);
const permission = await gh.permission(sender);
if (!ALLOWED.has(permission)) {
  // Starting a session spends the owner's budget, so it takes write access (HUM-1).
  await gh.comment(number, `\`${label}\` was ignored: @${sender} has \`${permission}\` access, and starting an agent session needs write access.`);
  console.error(`${sender} has ${permission} access; refusing to start a session.`);
  process.exit(1);
}
console.log(`Consumed ${label} on #${number}; ${sender} has ${permission} access.`);
