import type { ActionLogEntry, UserProfile } from './types';
import type { MemoryIntelligenceStore } from './memoryStore';
import { createKartikayProfile } from './profileFactory';

const STORAGE_KEY = 'kaal_intelligence_v1';

interface PersistedState {
  profile: UserProfile;
  logs: ActionLogEntry[];
}

export function persistIntelligenceStore(store: MemoryIntelligenceStore, userId: string): void {
  const profile = store.getProfile(userId);
  if (!profile) return;
  const state: PersistedState = { profile, logs: store.getLogs(userId) };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // quota or private mode — memory-only fallback
  }
}

export function hydrateIntelligenceStore(store: MemoryIntelligenceStore): string {
  const defaultId = createKartikayProfile().id;

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const state = JSON.parse(raw) as PersistedState;
      store.importState(state.profile.id, state.profile, state.logs);
      return state.profile.id;
    }
  } catch {
    // corrupt storage — fall through to seed
  }

  const profile = createKartikayProfile();
  store.saveProfile(profile);
  persistIntelligenceStore(store, profile.id);
  return defaultId;
}