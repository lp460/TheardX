/**
 * Optional synchronisation — architecture only (not implemented in 1.0).
 * A provider exchanges full backups (`threadshelf.backup` format) so every target — WebDAV,
 * personal storage, end-to-end-encrypted sync, a macOS/iOS companion app — reuses the validated,
 * transactional import path. Nothing syncs by default.
 */
import type { Backup } from '@/storage/backup';

export interface SyncProvider {
  readonly id: string;
  readonly label: string;
  /** Whether payloads are encrypted client-side before leaving the browser. */
  readonly encrypted: boolean;
  push(backup: Backup): Promise<{ revision: string }>;
  pull(sinceRevision?: string): Promise<{ backup: Backup; revision: string } | null>;
}

/** Default provider: local only. */
export const localOnly: SyncProvider = {
  id: 'local',
  label: 'Local uniquement',
  encrypted: false,
  push: async () => ({ revision: 'local' }),
  pull: async () => null,
};
