/** Public type surface for the Node-side Manifest V3 builder (manifest.mjs). */
export interface ExtensionManifest {
  manifest_version: number;
  key: string;
  permissions: string[];
  optional_host_permissions: string[];
  oauth2?: { client_id: string; scopes: string[] };
}

export declare function createManifest(
  pkg: { version: string },
  options?: { googleClientId?: string },
): ExtensionManifest;
