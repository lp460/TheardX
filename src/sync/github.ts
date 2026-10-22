/**
 * Minimal GitHub REST client: the signed-in user, the private library repository (found or
 * created automatically) and one file in it (Contents API, optimistic concurrency with the blob sha).
 */
import { base64ToBytes, bytesToBase64 } from './crypto';

export const GITHUB_API = 'https://api.github.com';
export const DEFAULT_REPO_NAME = 'threadshelf-data';

export type Fetcher = (url: string, init?: RequestInit) => Promise<Response>;

export class GitHubError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = 'GitHubError';
  }
}

/** The file changed on GitHub since it was read (another PC pushed in between). */
export class GitHubConflictError extends GitHubError {}

export interface GitHubRepo {
  full_name: string;
  private: boolean;
  default_branch: string;
  html_url: string;
}

function describe(status: number, body: string): string {
  if (status === 401) return 'Connexion GitHub expirée ou révoquée : reconnectez-vous.';
  if (status === 403 && /rate limit/i.test(body))
    return 'GitHub limite les requêtes : réessayez dans quelques minutes.';
  if (status === 403) return 'GitHub refuse l’accès (autorisation « repo » requise).';
  if (status === 404) return 'Dépôt ou fichier introuvable sur GitHub.';
  if (status >= 500) return `GitHub est indisponible (${status}).`;
  const msg = /"message"\s*:\s*"([^"]{1,200})"/.exec(body)?.[1];
  return `Erreur GitHub ${status}${msg ? ` : ${msg}` : ''}`;
}

const REPO_RE = /^[\w.-]{1,100}\/[\w.-]{1,100}$/;

export class GitHubClient {
  constructor(
    private readonly token: string,
    private readonly fetcher: Fetcher = (u, i) => fetch(u, i),
    private readonly api = GITHUB_API,
  ) {
    if (!token.trim()) throw new GitHubError('Connectez d’abord votre compte GitHub.', 0);
  }

  private async request(
    path: string,
    init: RequestInit & { accept?: string } = {},
  ): Promise<Response> {
    const { accept, ...rest } = init;
    try {
      return await this.fetcher(`${this.api}${path}`, {
        ...rest,
        credentials: 'omit',
        referrerPolicy: 'no-referrer',
        cache: 'no-store',
        headers: {
          Authorization: `Bearer ${this.token.trim()}`,
          Accept: accept ?? 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
          ...(rest.body ? { 'Content-Type': 'application/json' } : {}),
        },
      });
    } catch (e) {
      throw new GitHubError(
        `GitHub injoignable (${e instanceof Error ? e.message : String(e)}).`,
        0,
      );
    }
  }

  private async json<T>(path: string, init: RequestInit = {}): Promise<T> {
    const res = await this.request(path, init);
    const body = await res.text();
    if (!res.ok) throw new GitHubError(describe(res.status, body), res.status);
    return JSON.parse(body) as T;
  }

  user(): Promise<{ login: string; name: string | null }> {
    return this.json('/user');
  }

  repo(fullName: string): Promise<GitHubRepo> {
    if (!REPO_RE.test(fullName))
      throw new GitHubError('Nom de dépôt invalide (ex. : moncompte/threadshelf-data).', 0);
    return this.json(`/repos/${fullName}`);
  }

  /** The user's own repository with this name, created (private) if it does not exist. */
  async findOrCreateRepo(
    name = DEFAULT_REPO_NAME,
  ): Promise<{ repo: GitHubRepo; created: boolean; login: string }> {
    const { login } = await this.user();
    try {
      return { repo: await this.repo(`${login}/${name}`), created: false, login };
    } catch (e) {
      if (!(e instanceof GitHubError) || e.status !== 404) throw e;
    }
    const repo = await this.json<GitHubRepo>('/user/repos', {
      method: 'POST',
      body: JSON.stringify({
        name,
        private: true,
        auto_init: true,
        description: 'Bibliothèque ThreadShelf synchronisée (créée automatiquement).',
        has_issues: false,
        has_wiki: false,
        has_projects: false,
      }),
    });
    return { repo, created: true, login };
  }

  private contents(repo: string, path: string): string {
    return `/repos/${repo}/contents/${path.split('/').map(encodeURIComponent).join('/')}`;
  }

  /** Returns null when the file does not exist yet. `version` is the blob sha. */
  async readFile(
    repo: string,
    path: string,
    branch: string,
  ): Promise<{ text: string; version: string } | null> {
    const url = `${this.contents(repo, path)}?ref=${encodeURIComponent(branch)}`;
    const res = await this.request(url);
    const body = await res.text();
    if (res.status === 404) return null;
    if (!res.ok) throw new GitHubError(describe(res.status, body), res.status);
    const meta = JSON.parse(body) as {
      sha: string;
      content?: string;
      encoding?: string;
      size: number;
    };
    if (meta.encoding === 'base64' && meta.content) {
      return {
        text: new TextDecoder().decode(base64ToBytes(meta.content.replace(/\s/g, ''))),
        version: meta.sha,
      };
    }
    // Files over 1 MB: the JSON response has no content, ask for the raw file.
    const raw = await this.request(url, { accept: 'application/vnd.github.raw+json' });
    const text = await raw.text();
    if (!raw.ok) throw new GitHubError(describe(raw.status, text), raw.status);
    return { text, version: meta.sha };
  }

  /** Creates the file (version null) or updates it only if it is still at `version`. */
  async writeFile(
    repo: string,
    path: string,
    branch: string,
    text: string,
    version: string | null,
    message: string,
  ): Promise<void> {
    const body: Record<string, string> = {
      message,
      branch,
      content: bytesToBase64(new TextEncoder().encode(text)),
    };
    if (version) body.sha = version;
    const res = await this.request(this.contents(repo, path), {
      method: 'PUT',
      body: JSON.stringify(body),
    });
    const resBody = await res.text();
    if (res.ok) return;
    if (res.status === 409 || (res.status === 422 && /sha/i.test(resBody))) {
      throw new GitHubConflictError('Le fichier a été modifié sur GitHub entre-temps.', res.status);
    }
    throw new GitHubError(describe(res.status, resBody), res.status);
  }
}
