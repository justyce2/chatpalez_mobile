export type DiagnosticContext = Record<string, string | number | boolean | null | undefined>;

export function logDebug(message: string, context: DiagnosticContext = {}): void {
  if (!import.meta.env.DEV) return;
  console.debug(`[ChatPalezMobile] ${message}`, context);
}

export function logError(message: string, error?: unknown, context: DiagnosticContext = {}): void {
  const detail = error instanceof Error ? error.message : String(error ?? '');
  console.error(`[ChatPalezMobile] ${message}`, { ...context, detail });
}
