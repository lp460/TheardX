import { GitHubConflictError, GitHubError, type GitHubRepo } from '@/sync/github';
import type { SyncClient } from '@/sync/engine';

async function request(method: 'GET' | 'PUT', url: string, body?: unknown): Promise<unknown> {
  let response: Response;
  try {
    response = await fetch(url, {
      method,
      credentials: 'same-origin',
      cache: 'no-store',
      ...(body ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {}),
    });
  } catch {
    throw new GitHubError('Connexion indisponible, réessayez une fois en ligne.', 0);
  }
  const data = await response.json().catch(() => ({})) as { error?: string };
  if (!response.ok) {
    if (response.status === 409 || response.status === 422)
      throw new GitHubConflictError(data.error || 'Conflit de synchronisation.', response.status);
    throw new GitHubError(data.error || `Erreur de synchronisation HTTP ${response.status}`, response.status);
  }
  return data;
}

export class WebGitHubClient implements SyncClient {
  constructor(private readonly login: string) {}

  async repo(fullName: string): Promise<GitHubRepo> {
    if (fullName !== `${this.login}/threadshelf-data`)
      throw new GitHubError('Bibliothèque GitHub incorrecte.', 403);
    const data = await request('GET', '/api/sync?meta=1') as {
      repo: { full_name: string; private: boolean; default_branch: string };
    };
    return { ...data.repo, html_url: `https://github.com/${fullName}` };
  }

  async readFile(repo: string, path: string, branch: string) {
    await this.validateTarget(repo, path, branch);
    const data = await request('GET', '/api/sync') as { file: { text: string; version: string } | null };
    return data.file;
  }

  async writeFile(repo: string, path: string, branch: string, text: string, version: string | null) {
    await this.validateTarget(repo, path, branch);
    await request('PUT', '/api/sync', { text, version });
  }

  private async validateTarget(repo: string, path: string, branch: string): Promise<void> {
    if (repo !== `${this.login}/threadshelf-data` || path !== 'threadshelf/library.json' || !branch)
      throw new GitHubError('Cible de synchronisation incorrecte.', 403);
  }
}
