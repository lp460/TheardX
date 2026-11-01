const ACCOUNT_KEY = 'threadshelf.web.account';
const LOGGED_OUT_KEY = 'threadshelf.web.logged-out';

export type WebAuth =
  | { phase: 'loading' | 'signed-out' | 'account-mismatch'; login: null }
  | { phase: 'online' | 'offline'; login: string };

function stored(): string | null {
  try { return localStorage.getItem(ACCOUNT_KEY); } catch { return null; }
}

export async function resolveWebAuth(): Promise<WebAuth> {
  const account = stored();
  const loggedOut = localStorage.getItem(LOGGED_OUT_KEY) === '1';
  try {
    const response = await fetch('/api/auth/me', { credentials: 'same-origin', cache: 'no-store' });
    if (response.status === 401) return { phase: 'signed-out', login: null };
    if (!response.ok) throw new Error('GitHub inaccessible');
    const data = await response.json() as { login?: string };
    if (!data.login) throw new Error('Utilisateur inconnu');
    if (account && account !== data.login) return { phase: 'account-mismatch', login: null };
    localStorage.setItem(ACCOUNT_KEY, data.login);
    localStorage.removeItem(LOGGED_OUT_KEY);
    return { phase: 'online', login: data.login };
  } catch {
    return account && !loggedOut
      ? { phase: 'offline', login: account }
      : { phase: 'signed-out', login: null };
  }
}

export async function signOut(): Promise<void> {
  const response = await fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin' });
  if (!response.ok) throw new Error('Déconnexion impossible. Réessayez.');
  localStorage.setItem(LOGGED_OUT_KEY, '1');
}

/** Existing local data are not destroyed; a different GitHub account must use a separate profile. */
export function accountMismatchMessage(): string {
  return 'Ce navigateur possède déjà une bibliothèque locale liée à un autre compte GitHub. Utilisez un profil de navigateur distinct pour éviter de mélanger les données.';
}
