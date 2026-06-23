import type { IntelligenceStore } from './memoryStore';
import { MemoryIntelligenceStore, defaultIntelligenceStore } from './memoryStore';
import { hydrateIntelligenceStore, persistIntelligenceStore } from './persistence';

export type StoreBackend = 'sqlite' | 'memory';

export interface BootstrappedStore {
  store: IntelligenceStore;
  userId: string;
  backend: StoreBackend;
}

let active: BootstrappedStore | null = null;

export async function bootstrapIntelligenceStore(): Promise<BootstrappedStore> {
  if (active) return active;

  if (typeof indexedDB !== 'undefined') {
    try {
      const { SqliteIntelligenceStore } = await import('./sqliteStore');
      const sqlite = await SqliteIntelligenceStore.create();
      const userId = await sqlite.hydrate();
      active = { store: sqlite, userId, backend: 'sqlite' };
      return active;
    } catch {
      // fall through to memory
    }
  }

  const mem = defaultIntelligenceStore;
  const userId = hydrateIntelligenceStore(mem as MemoryIntelligenceStore);
  active = { store: mem, userId, backend: 'memory' };
  return active;
}

export async function persistActiveStore(userId: string): Promise<void> {
  if (!active) return;

  if (active.backend === 'sqlite') {
    const store = active.store as { flush?: () => Promise<void> };
    if (typeof store.flush === 'function') {
      await store.flush();
    }
    return;
  }

  persistIntelligenceStore(active.store as MemoryIntelligenceStore, userId);
}

export function getActiveStore(): BootstrappedStore | null {
  return active;
}