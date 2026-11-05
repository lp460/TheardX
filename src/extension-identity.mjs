/**
 * Public RSA key for a stable ID in unpacked Chromium extensions.
 *
 * Do not regenerate this key: existing Google OAuth client registrations and
 * installed extensions depend on the resulting ID. This key is PUBLIC and is
 * intentionally versioned with the source. No private key is stored here.
 *
 * A future Chrome Web Store publication must reconcile its store-assigned ID
 * before switching existing users to the store build.
 */
export const EXTENSION_PUBLIC_KEY =
  'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAwwr1tJzJS8B4YKQsJePzLwHc2HAwL42cbBXESDT/1hh1vYAHFkoghQRQDI9z3Ftehs81J7jTTL/oFGK2xZxyvb3A9rgtf4kLOCRnPkU/Z47ALQTJtHtztb7mvDSShkFuFUmLPb4WFzu7fT5cKfvwDMD8oBAe0mw4nWnYpTTtBXH/YIqdH+dyHtclPBnl7bOXDqy5sm6P9oOxm4HGP2iYEhdP9z5QVGLUUzgnq1wZgiXsS8LEtFb0bIjCXyPUixc7VzYpKlhXTt5n6URmNY9Gsv+gTMZ8C71Ez2/ww8T7m0ubqxPwImj41dWx7Q65ZeKGYCmJOdSlo0/M4tDTeAOQ5QIDAQAB';

/** The fixed Chromium extension ID derived from EXTENSION_PUBLIC_KEY. */
export const EXTENSION_ID = 'finnpgeglikfoejkedoobkigbfgmbglf';

/**
 * Public OAuth client ID for Google Cloud's "Chrome Extension" client type.
 * Set this ONCE after registering EXTENSION_ID in Google Cloud. Unlike a web
 * OAuth client secret, a Chrome extension OAuth client ID is public and safe
 * to include in the manifest; no Vercel environment variable is needed.
 */
export const CHROME_OAUTH_CLIENT_ID =
  '29268983058-gtne0dru73vme0iq777ln7g72so44sf4.apps.googleusercontent.com';
