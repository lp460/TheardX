const ACCOUNT_KEY = 'threadshelf.web.account';
const LOGGED_OUT_KEY = 'threadshelf.web.logged-out';
const ACCOUNT_INFO_KEY = 'threadshelf.web.account-info';

export interface WebIdentity {
  login: string;
  provider: 'github' | 'google';
  accountId: string;
}

export type WebAuth =
  | {
      phase: 'loading' | 'signed-out' | 'account-mismatch';
      login: null;
      provider: null;
      accountId: null;
    }
  | ({ phase: 'online' | 'offline' } & WebIdentity);

function stored(): string | null {
  try {
    return localStorage.getItem(ACCOUNT_KEY);
  } catch {
    return null;
  }
}

export async function resolveWebAuth(): Promise<WebAuth> {
  const account = stored();
  const loggedOut = localStorage.getItem(LOGGED_OUT_KEY) === '1';
  try {
    const response = await fetch('/api/auth/me', { credentials: 'same-origin', cache: 'no-store' });
    if (response.status === 401)
      return { phase: 'signed-out', login: null, provider: null, accountId: null };
    if (!response.ok) throw new Error('Service de connexion inaccessible');
    const data = (await response.json()) as {
      login?: string;
      provider?: 'github' | 'google';
      accountId?: string;
    };
    if (!data.login) throw new Error('Utilisateur inconnu');
    const provider = data.provider ?? 'github';
    const accountId = data.accountId ?? `github:${data.login.toLowerCase()}`;
    // Compatibility with the original GitHub-only account marker.
    if (account && account !== accountId && !(provider === 'github' && account === data.login))
      return { phase: 'account-mismatch', login: null, provider: null, accountId: null };
    const identity: WebIdentity = { login: data.login, provider, accountId };
    localStorage.setItem(ACCOUNT_KEY, accountId);
    localStorage.setItem(ACCOUNT_INFO_KEY, JSON.stringify(identity));
    localStorage.removeItem(LOGGED_OUT_KEY);
    return { phase: 'online', ...identity };
  } catch {
    try {
      const identity = JSON.parse(
        localStorage.getItem(ACCOUNT_INFO_KEY) ?? 'null',
      ) as WebIdentity | null;
      if (account && !loggedOut && identity?.accountId === account)
        return { phase: 'offline', ...identity };
    } catch {
      /* No usable cached identity. */
    }
    return { phase: 'signed-out', login: null, provider: null, accountId: null };
  }
}

export async function signOut(): Promise<void> {
  const response = await fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin' });
  if (!response.ok) throw new Error('Déconnexion impossible. Réessayez.');
  localStorage.setItem(LOGGED_OUT_KEY, '1');
}

/** Existing local data are not destroyed; other cloud accounts must use a separate browser profile. */
export function accountMismatchMessage(): string {
  return 'Ce navigateur possède déjà une bibliothèque locale liée à un autre compte. Utilisez un profil distinct pour éviter de mélanger les données.';
}
