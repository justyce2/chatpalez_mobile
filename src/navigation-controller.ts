import type { AppConfig } from './config';
import { isTrustedInternalUrl, openExternalUrl } from './navigation';

export type NavigationDecision =
  | { kind: 'internal'; url: string }
  | { kind: 'external'; url: string }
  | { kind: 'blocked'; url: string };

export function classifyNavigation(rawUrl: string, config: AppConfig): NavigationDecision {
  try {
    const url = new URL(rawUrl, config.origin);

    if (isTrustedInternalUrl(url.toString(), config)) {
      return { kind: 'internal', url: url.toString() };
    }

    if (['http:', 'https:', 'mailto:', 'tel:'].includes(url.protocol)) {
      return { kind: 'external', url: url.toString() };
    }

    return { kind: 'blocked', url: url.toString() };
  } catch {
    return { kind: 'blocked', url: rawUrl };
  }
}

export async function handleNavigation(rawUrl: string, config: AppConfig): Promise<NavigationDecision> {
  const decision = classifyNavigation(rawUrl, config);
  if (decision.kind === 'external') {
    await openExternalUrl(decision.url);
  }
  return decision;
}
