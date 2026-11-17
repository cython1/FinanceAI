/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Base URL of node-api as seen from the browser (shared/.env.example). */
  readonly VITE_API_BASE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
