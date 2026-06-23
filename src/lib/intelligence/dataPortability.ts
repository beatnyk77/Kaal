import type { IntelligenceStore } from './memoryStore';
import { MemoryIntelligenceStore } from './memoryStore';
import { SqliteIntelligenceStore } from './sqliteStore';
import type { ActionLogEntry, UserProfile } from './types';

export const EXPORT_BUNDLE_VERSION = '1.0.0';

export interface IntelligenceExportBundle {
  version: typeof EXPORT_BUNDLE_VERSION;
  exported_at: string;
  profile: UserProfile;
  logs: ActionLogEntry[];
}

export function buildExportBundle(store: IntelligenceStore, userId: string): IntelligenceExportBundle | null {
  const profile = store.getProfile(userId);
  if (!profile) return null;

  return {
    version: EXPORT_BUNDLE_VERSION,
    exported_at: new Date().toISOString(),
    profile,
    logs: store.getLogs(userId),
  };
}

export function downloadExportBundle(bundle: IntelligenceExportBundle, filename?: string): void {
  const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename ?? `kaal-export-${bundle.profile.id}-${bundle.exported_at.slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export function parseImportBundle(raw: string): IntelligenceExportBundle {
  const parsed = JSON.parse(raw) as Partial<IntelligenceExportBundle>;
  if (!parsed.profile?.id || !Array.isArray(parsed.logs)) {
    throw new Error('Invalid export file: missing profile or logs.');
  }
  if (parsed.version && parsed.version !== EXPORT_BUNDLE_VERSION) {
    throw new Error(`Unsupported export version "${parsed.version}". Expected ${EXPORT_BUNDLE_VERSION}.`);
  }
  return {
    version: EXPORT_BUNDLE_VERSION,
    exported_at: parsed.exported_at ?? new Date().toISOString(),
    profile: parsed.profile,
    logs: parsed.logs,
  };
}

export async function importExportBundle(
  store: IntelligenceStore,
  bundle: IntelligenceExportBundle
): Promise<string> {
  const userId = bundle.profile.id;

  if (store instanceof MemoryIntelligenceStore) {
    store.importState(userId, bundle.profile, bundle.logs);
    return userId;
  }

  if (store instanceof SqliteIntelligenceStore) {
    store.importState(userId, bundle.profile, bundle.logs);
    await store.flush();
    return userId;
  }

  throw new Error('Unsupported intelligence store for import.');
}