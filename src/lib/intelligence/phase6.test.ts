import { describe, it, expect, beforeEach } from 'vitest';
import {
  MemoryIntelligenceStore,
  createKartikayProfile,
  applyProfileForm,
  profileToFormValues,
  buildExportBundle,
  parseImportBundle,
  importExportBundle,
} from './index';

describe('Phase 6 — profile & portability', () => {
  let store: MemoryIntelligenceStore;

  beforeEach(() => {
    store = new MemoryIntelligenceStore();
    store.saveProfile(createKartikayProfile());
  });

  it('derives BTN and transition from birth time on save', () => {
    const profile = store.getProfile('kartikay-default')!;
    const form = profileToFormValues(profile);
    const updated = applyProfileForm(profile, { ...form, birthTime: '10:20' });
    expect(updated.numerology.btn).toBe(3);
    expect(updated.personal_hours.transition_minute).toBe(20);
  });

  it('round-trips export bundle through import', async () => {
    const bundle = buildExportBundle(store, 'kartikay-default')!;
    const raw = JSON.stringify(bundle);
    const parsed = parseImportBundle(raw);

    const fresh = new MemoryIntelligenceStore();
    const id = await importExportBundle(fresh, parsed);
    expect(id).toBe('kartikay-default');
    expect(fresh.getProfile(id)?.identity.display_name).toBe('Kartikay Sharma');
    expect(fresh.getLogs(id)).toHaveLength(0);
  });

  it('rejects invalid import bundle', () => {
    expect(() => parseImportBundle('{}')).toThrow(/Invalid export/);
  });
});