export type DiagnosticContext = Record<string, string | number | boolean | null | undefined>;
export type DiagnosticLevel = 'debug' | 'info' | 'warn' | 'error';

export type DiagnosticEntry = {
  at: string;
  level: DiagnosticLevel;
  message: string;
  context: Record<string, string | number | boolean | null>;
};

const MAX_ENTRIES = 75;
const MAX_TEXT_LENGTH = 500;
const SENSITIVE_KEY = /(authorization|bearer|cookie|password|passwd|secret|session|token|auth[_-]?key|api[_-]?key|private[_-]?key)/i;
const SENSITIVE_QUERY_KEY = /^(token|access_token|refresh_token|auth_key|session|session_id|secret|password|passwd|api_key|key)$/i;
const entries: DiagnosticEntry[] = [];

function trimText(value: string): string {
  return value.slice(0, MAX_TEXT_LENGTH);
}

function redactUrl(raw: string): string {
  try {
    const url = new URL(raw);
    for (const key of Array.from(url.searchParams.keys())) {
      if (SENSITIVE_QUERY_KEY.test(key)) {
        url.searchParams.set(key, '[redacted]');
      }
    }
    url.hash = '';
    return trimText(url.toString());
  } catch {
    return trimText(raw);
  }
}

function sanitizeString(value: string): string {
  const withoutBearer = value.replace(/Bearer\s+[A-Za-z0-9._~+\/-]+=*/gi, 'Bearer [redacted]');
  const withoutInlineSecrets = withoutBearer.replace(
    /([?&](?:token|access_token|refresh_token|auth_key|session|session_id|secret|password|passwd|api_key|key)=)[^&\s]+/gi,
    '$1[redacted]'
  );

  if (/^https?:\/\//i.test(withoutInlineSecrets)) {
    return redactUrl(withoutInlineSecrets);
  }

  return trimText(withoutInlineSecrets);
}

function sanitizeContext(context: DiagnosticContext): Record<string, string | number | boolean | null> {
  const safe: Record<string, string | number | boolean | null> = {};

  for (const [key, value] of Object.entries(context)) {
    if (value === undefined) continue;

    if (SENSITIVE_KEY.test(key)) {
      safe[key] = '[redacted]';
      continue;
    }

    if (typeof value === 'string') {
      safe[key] = sanitizeString(value);
      continue;
    }

    safe[key] = value;
  }

  return safe;
}

export function recordDiagnostic(
  level: DiagnosticLevel,
  message: string,
  context: DiagnosticContext = {}
): DiagnosticEntry {
  const entry: DiagnosticEntry = {
    at: new Date().toISOString(),
    level,
    message: sanitizeString(message),
    context: sanitizeContext(context)
  };

  entries.push(entry);
  if (entries.length > MAX_ENTRIES) {
    entries.splice(0, entries.length - MAX_ENTRIES);
  }

  return entry;
}

export function getDiagnosticSnapshot(): DiagnosticEntry[] {
  return entries.map((entry) => ({ ...entry, context: { ...entry.context } }));
}

export function clearDiagnostics(): void {
  entries.length = 0;
}

export function logDebug(message: string, context: DiagnosticContext = {}): void {
  const entry = recordDiagnostic('debug', message, context);
  if (import.meta.env.DEV) console.debug('[ChatPalezMobile]', entry);
}

export function logInfo(message: string, context: DiagnosticContext = {}): void {
  const entry = recordDiagnostic('info', message, context);
  if (import.meta.env.DEV) console.info('[ChatPalezMobile]', entry);
}

export function logWarn(message: string, context: DiagnosticContext = {}): void {
  const entry = recordDiagnostic('warn', message, context);
  if (import.meta.env.DEV) console.warn('[ChatPalezMobile]', entry);
}

export function logError(message: string, error?: unknown, context: DiagnosticContext = {}): void {
  const detail = error instanceof Error ? error.message : String(error ?? '');
  const entry = recordDiagnostic('error', message, { ...context, detail });
  if (import.meta.env.DEV) console.error('[ChatPalezMobile]', entry);
}
