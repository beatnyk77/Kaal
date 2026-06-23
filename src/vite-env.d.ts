/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_JYOTISH_API_URL?: string;
  readonly VITE_JYOTISH_API_KEY?: string;
  readonly VITE_JYOTISH_USE_STUB?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}