interface ImportMetaEnv {
  readonly VITE_CHATPALEZ_ORIGIN?: string;
  readonly VITE_ALLOWED_HOSTS?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
