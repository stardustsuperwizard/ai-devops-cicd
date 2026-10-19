// The few things that differ between repositories, read from
// .github/agents.json. Everything else in scripts/agents/ is the same
// everywhere, so upgrading the template is a copy, not a merge.

import { readFileSync, existsSync } from 'node:fs';

export const DEFAULT_CONFIG = {
  // Task issues are labeled with exactly one area. Keep it short: each area is
  // a label, and the planner must pick one per task.
  areas: ['backend', 'frontend', 'infra', 'docs'],
  // Added to a PR when the reviewer marks a criterion [owner to check]: something
  // a person must try before merging that no check can prove.
  humanCheckLabel: 'needs-human-check',
};

export function loadConfig(path = '.github/agents.json') {
  if (!existsSync(path)) return { ...DEFAULT_CONFIG };
  const raw = JSON.parse(readFileSync(path, 'utf8'));
  const config = { ...DEFAULT_CONFIG, ...raw };
  if (!Array.isArray(config.areas) || !config.areas.length || !config.areas.every((a) => typeof a === 'string' && a)) {
    throw new Error(`${path}: "areas" must be a non-empty list of label names.`);
  }
  if (typeof config.humanCheckLabel !== 'string' || !config.humanCheckLabel) throw new Error(`${path}: "humanCheckLabel" must be a label name.`);
  return config;
}
