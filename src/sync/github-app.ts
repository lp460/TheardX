/**
 * Client ID of the « ThreadShelf » OAuth App on GitHub (public identifier, not a secret).
 * Registered once by the owner of this extension, with « Enable Device Flow » checked; every PC
 * then signs in with « Se connecter avec GitHub ». Can be overridden in the settings.
 *
 * Registration: https://github.com/settings/applications/new
 *   Application name: ThreadShelf · Homepage URL: https://github.com
 *   Redirect URI: https://github.com (required by the form, unused by the device flow)
 *   Enable Device Flow: checked · Expire user access tokens: unchecked
 */
export const GITHUB_OAUTH_CLIENT_ID = 'Ov23liLkMRkSELNiYB2U';
