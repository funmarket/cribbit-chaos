/// <reference lib="dom" />
declare module '*.css';
declare module '*.html?raw' {
  const source: string;
  export default source;
}
interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
  readonly VITE_WS_URL?: string;
  readonly VITE_APP_ENV?: string;
}
interface ImportMeta { readonly env: ImportMetaEnv; }
