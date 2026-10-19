// How a Claude Code session ended, decided from harness evidence only: the
// CLI's exit code, its JSON envelope's own fields, and whether the session
// changed files it must not. Never from the model's answer, which is
// model-authored and may mention any failure by name (ai-devops-cicd OUT-3).
//
// One small vocabulary, used by every agent workflow:
//   completed         finished normally; its answer may be believed
//   budget_exhausted  hit --max-budget-usd (or a turn limit); never a verdict
//   failed            errored, produced no envelope, or broke read-only
//   not_run           no credential, so no session started

export const OUTCOMES = ['completed', 'budget_exhausted', 'failed', 'not_run'];

/**
 * @param {object} evidence
 * @param {boolean} evidence.ran          false when no session was started
 * @param {string}  [evidence.notRunReason]
 * @param {number}  [evidence.exitCode]
 * @param {string}  [evidence.stdout]      the --output-format json envelope
 * @param {string}  [evidence.stderr]
 * @param {boolean} [evidence.treeModified] the working tree changed during a read-only session
 */
export function classifyOutcome({ ran, notRunReason = '', exitCode = 0, stdout = '', stderr = '', treeModified = false }) {
  // Unavailable fields are zeroed, not omitted (OUT-2), so consumers never branch on shape.
  const base = { outcome: 'failed', reason: '', result: '', costUsd: 0, durationMs: 0, turns: 0, sessionId: '' };
  if (!ran) return { ...base, outcome: 'not_run', reason: notRunReason || 'No session was started.' };

  let envelope = null;
  try {
    envelope = JSON.parse(stdout.trim().split('\n').filter(Boolean).at(-1) ?? '');
  } catch {
    envelope = null;
  }
  const info = envelope && typeof envelope === 'object' ? envelope : {};
  const facts = {
    ...base,
    result: typeof info.result === 'string' ? info.result : '',
    costUsd: Number(info.total_cost_usd) || 0,
    durationMs: Number(info.duration_ms) || 0,
    turns: Number(info.num_turns) || 0,
    sessionId: typeof info.session_id === 'string' ? info.session_id : '',
  };

  if (treeModified) return { ...facts, reason: 'The session changed files during a read-only run.' };
  if (!envelope) {
    const tail = stderr.trim().split('\n').slice(-3).join(' ').slice(0, 300);
    return { ...facts, reason: `No result envelope (exit ${exitCode}).${tail ? ` stderr: ${tail}` : ''}` };
  }
  const subtype = String(info.subtype ?? '');
  if (/budget|max_turns/i.test(subtype)) return { ...facts, outcome: 'budget_exhausted', reason: `Stopped at a limit (${subtype}).` };
  if (info.is_error === true || subtype !== 'success' || exitCode !== 0) {
    return { ...facts, reason: `Session error (${subtype || 'unknown'}, exit ${exitCode}).` };
  }
  return { ...facts, outcome: 'completed' };
}

/** A hidden marker recording what a session cost and how it ended (ai-devops-cicd OBS-6, OBS-10). */
export function sessionMarker({ role, model, effort, outcome, costUsd, durationMs, turns, round, implementer }) {
  const record = { role, model, effort, outcome, costUsd: Math.round(costUsd * 10000) / 10000, durationMs, turns };
  if (round !== undefined) record.round = round;
  // The implementer's time, for the run log: how long the work took, and
  // whether any session ran close to its limit.
  if (implementer) {
    record.implementer = {
      sessions: implementer.sessions.length,
      totalMs: implementer.totalMs,
      nearLimit: implementer.anyNearLimit,
      limitMs: implementer.sessions.at(-1)?.limitMs ?? null,
    };
  }
  return `<!-- agent-session ${JSON.stringify(record)} -->`;
}
