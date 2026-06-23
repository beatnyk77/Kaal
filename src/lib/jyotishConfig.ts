import type { JyotishAdapterOptions } from './jyotishAdapter';

function readViteEnv(key: keyof ImportMetaEnv): string | undefined {
  const value = import.meta.env[key];
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function readApiMode(): JyotishAdapterOptions['apiMode'] {
  const raw = readViteEnv('VITE_JYOTISH_API_MODE');
  if (raw === 'beatnyk' || raw === 'legacy' || raw === 'auto') return raw;
  return 'auto';
}

/** Read jyotish-api settings from Vite env. */
export function getDefaultJyotishOptions(overrides: JyotishAdapterOptions = {}): JyotishAdapterOptions {
  const baseUrl = overrides.baseUrl ?? readViteEnv('VITE_JYOTISH_API_URL');
  const apiKey = overrides.apiKey ?? readViteEnv('VITE_JYOTISH_API_KEY');
  const useStubFlag = overrides.useStub ?? readViteEnv('VITE_JYOTISH_USE_STUB') === 'true';

  return {
    timeoutMs: 12_000,
    baseUrl: baseUrl || undefined,
    apiKey: apiKey || undefined,
    useStub: useStubFlag,
    apiMode: overrides.apiMode ?? readApiMode(),
    ...overrides,
  };
}

export function isJyotishLiveEnabled(opts: JyotishAdapterOptions): boolean {
  return Boolean(opts.baseUrl && !opts.useStub);
}