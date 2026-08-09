/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
  readonly VITE_REALTIME_URL?: string;
  readonly VITE_APP_ENV?: 'development' | 'preview' | 'production';
}

interface ImportMeta { readonly env: ImportMetaEnv; }
