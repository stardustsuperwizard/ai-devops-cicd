// A minimal GitHub REST/GraphQL client on Node's fetch, so the agent scripts
// need no dependencies and run the same from a laptop as in Actions:
//   GITHUB_TOKEN=… GITHUB_REPOSITORY=owner/repo node scripts/agents/review.js …

export function github({
  token = process.env.GITHUB_TOKEN,
  repository = process.env.GITHUB_REPOSITORY,
  api = process.env.GITHUB_API_URL ?? 'https://api.github.com',
  // GitHub Enterprise Server serves GraphQL beside REST, not under it
  // (/api/graphql, not /api/v3/graphql); Actions sets this for either host.
  graphqlUrl = process.env.GITHUB_GRAPHQL_URL ?? `${api}/graphql`,
} = {}) {
  if (!token) throw new Error('GITHUB_TOKEN is not set.');
  if (!/^[^/]+\/[^/]+$/.test(repository ?? '')) throw new Error('GITHUB_REPOSITORY must be owner/repo.');
  const [owner, repo] = repository.split('/');

  async function request(method, path, body) {
    const res = await fetch(/^https?:\/\//.test(path) ? path : `${api}${path}`, {
      method,
      headers: {
        authorization: `Bearer ${token}`,
        accept: 'application/vnd.github+json',
        'x-github-api-version': '2022-11-28',
        ...(body ? { 'content-type': 'application/json' } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) {
      const err = new Error(`${method} ${path} failed: ${res.status} ${(await res.text()).slice(0, 300)}`);
      err.status = res.status;
      throw err;
    }
    return res.status === 204 ? null : res.json();
  }

  async function paginate(path) {
    const out = [];
    for (let page = 1; ; page++) {
      const sep = path.includes('?') ? '&' : '?';
      const items = await request('GET', `${path}${sep}per_page=100&page=${page}`);
      out.push(...items);
      if (items.length < 100) return out;
    }
  }

  async function graphql(query, variables) {
    const data = await request('POST', graphqlUrl, { query, variables });
    if (data.errors?.length) throw new Error(`GraphQL: ${data.errors.map((e) => e.message).join('; ')}`);
    return data.data;
  }

  const repoPath = `/repos/${owner}/${repo}`;
  return {
    owner,
    repo,
    request,
    paginate,
    graphql,
    repoPath,

    comment: (number, body) => request('POST', `${repoPath}/issues/${number}/comments`, { body }),
    comments: (number) => paginate(`${repoPath}/issues/${number}/comments`),

    /** Add labels without replacing the existing set (ai-devops-cicd DSP-9). */
    addLabels: (number, labels) => request('POST', `${repoPath}/issues/${number}/labels`, { labels }),
    async removeLabel(number, name) {
      try {
        await request('DELETE', `${repoPath}/issues/${number}/labels/${encodeURIComponent(name)}`);
      } catch (err) {
        if (err.status !== 404) throw err; // already gone is fine
      }
    },

    async permission(username) {
      const res = await request('GET', `${repoPath}/collaborators/${encodeURIComponent(username)}/permission`);
      return res.permission; // admin | maintain | write | triage | read | none
    },
  };
}

/** Comments written by the repository owner, the only humans whose words reach a prompt. */
export function ownerComments(comments, owner) {
  return comments.filter((c) => c.user?.login?.toLowerCase() === owner.toLowerCase()).map((c) => c.body ?? '');
}
