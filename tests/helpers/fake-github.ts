/**
 * In-memory imitation of the GitHub endpoints used by the sync: device flow (github.com),
 * user, repository creation and Contents API (api.github.com).
 */
export interface FakeGitHub {
  fetcher: (url: string, init?: RequestInit) => Promise<Response>;
  files: Map<string, { content: string; sha: string }>;
  commits: number;
  repoExists: boolean;
  repoPrivate: boolean;
  reposCreated: number;
  /** Serve files over this size without inline content (like GitHub above 1 MB). */
  inlineLimit: number;
  deviceFlowEnabled: boolean;
  /** Pending device codes → approved? */
  devices: Map<string, 'pending' | 'approved' | 'denied'>;
  /** Simulates the user clicking « Authorize » on github.com/login/device. */
  approveAll: () => void;
  tokens: Set<string>;
  beforeWrite?: () => Promise<void> | void;
  rawText: (path: string) => string | undefined;
}

const b64 = (text: string) => Buffer.from(text, 'utf8').toString('base64');

export function fakeGitHub(
  opts: { login?: string; token?: string; clientId?: string } = {},
): FakeGitHub {
  const login = opts.login ?? 'lorry';
  const repoName = `${login}/threadshelf-data`;
  const clientId = opts.clientId ?? 'Ov23liTEST';
  const state: FakeGitHub = {
    files: new Map(),
    commits: 0,
    repoExists: true,
    repoPrivate: true,
    reposCreated: 0,
    inlineLimit: 1_000_000,
    deviceFlowEnabled: true,
    devices: new Map(),
    approveAll: () => {
      for (const k of state.devices.keys())
        if (state.devices.get(k) === 'pending') state.devices.set(k, 'approved');
    },
    tokens: new Set([opts.token ?? 'gho_test']),
    rawText: (path) => {
      const f = state.files.get(path);
      return f ? Buffer.from(f.content, 'base64').toString('utf8') : undefined;
    },
    fetcher: async (url, init = {}) => {
      const u = new URL(url);
      const method = init.method ?? 'GET';
      const headers = new Headers(init.headers);
      // --- device flow (github.com) ---
      if (u.host === 'github.com' && u.pathname === '/login/device/code') {
        const form = new URLSearchParams(String(init.body));
        if (form.get('client_id') !== clientId)
          return Response.json({ error: 'unauthorized_client' });
        if (!state.deviceFlowEnabled) return Response.json({ error: 'device_flow_disabled' });
        const dc = `dc-${state.devices.size + 1}`;
        state.devices.set(dc, 'pending');
        return Response.json({
          device_code: dc,
          user_code: 'WDJB-MJHT',
          verification_uri: 'https://github.com/login/device',
          expires_in: 900,
          interval: 1,
        });
      }
      if (u.host === 'github.com' && u.pathname === '/login/oauth/access_token') {
        const form = new URLSearchParams(String(init.body));
        if (form.has('client_secret')) return Response.json({ error: 'unexpected_secret' });
        if (form.get('grant_type') !== 'urn:ietf:params:oauth:grant-type:device_code')
          return Response.json({ error: 'unsupported_grant_type' });
        const st = state.devices.get(form.get('device_code') ?? '');
        if (!st) return Response.json({ error: 'expired_token' });
        if (st === 'pending') return Response.json({ error: 'authorization_pending' });
        if (st === 'denied') return Response.json({ error: 'access_denied' });
        state.devices.delete(form.get('device_code')!);
        const token = `gho_${state.tokens.size + 1}`;
        state.tokens.add(token);
        return Response.json({ access_token: token, token_type: 'bearer', scope: 'repo' });
      }
      // --- REST API (api.github.com) ---
      const bearer = /^Bearer (.+)$/.exec(headers.get('Authorization') ?? '')?.[1];
      if (!bearer || !state.tokens.has(bearer))
        return Response.json({ message: 'Bad credentials' }, { status: 401 });
      const path = decodeURIComponent(u.pathname);
      if (path === '/user') return Response.json({ login, name: 'Lorry' });
      const repoJson = () => ({
        full_name: repoName,
        private: state.repoPrivate,
        default_branch: 'main',
        html_url: `https://github.com/${repoName}`,
      });
      if (path === `/repos/${repoName}` && method === 'GET') {
        return state.repoExists
          ? Response.json(repoJson())
          : Response.json({ message: 'Not Found' }, { status: 404 });
      }
      if (path === '/user/repos' && method === 'POST') {
        const body = JSON.parse(String(init.body)) as {
          name: string;
          private: boolean;
          auto_init: boolean;
        };
        if (state.repoExists)
          return Response.json({ message: 'name already exists on this account' }, { status: 422 });
        state.repoExists = true;
        state.repoPrivate = body.private;
        state.reposCreated += 1;
        return Response.json(repoJson(), { status: 201 });
      }
      const m = new RegExp(`^/repos/${repoName}/contents/(.+)$`).exec(path);
      if (!m || !state.repoExists) return Response.json({ message: 'Not Found' }, { status: 404 });
      const file = m[1]!;
      const existing = state.files.get(file);
      if (method === 'GET') {
        if (!existing) return Response.json({ message: 'Not Found' }, { status: 404 });
        const text = Buffer.from(existing.content, 'base64').toString('utf8');
        if (headers.get('Accept') === 'application/vnd.github.raw+json') return new Response(text);
        const size = Buffer.byteLength(text);
        if (size > state.inlineLimit)
          return Response.json({ sha: existing.sha, size, encoding: 'none', content: '' });
        // GitHub wraps base64 content every 60 characters.
        return Response.json({
          sha: existing.sha,
          size,
          encoding: 'base64',
          content: existing.content.replace(/(.{60})/g, '$1\n'),
        });
      }
      if (method === 'PUT') {
        const body = JSON.parse(String(init.body)) as {
          content: string;
          sha?: string;
          message: string;
          branch: string;
        };
        await state.beforeWrite?.();
        const current = state.files.get(file);
        if (current && !body.sha)
          return Response.json(
            { message: 'Invalid request.\n\n"sha" wasn\'t supplied.' },
            { status: 422 },
          );
        if (current && body.sha !== current.sha)
          return Response.json({ message: 'is at a different sha' }, { status: 409 });
        if (!current && body.sha) return Response.json({ message: 'Not Found' }, { status: 404 });
        state.commits += 1;
        state.files.set(file, { content: body.content, sha: `sha${state.commits}` });
        return Response.json(
          { content: { sha: `sha${state.commits}` } },
          { status: current ? 200 : 201 },
        );
      }
      return Response.json({ message: 'Not Found' }, { status: 404 });
    },
  };
  void b64;
  return state;
}
