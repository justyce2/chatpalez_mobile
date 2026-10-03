# Mobile Runtime Source

This directory contains the shared TypeScript layer for the ChatPalez mobile application shell.

- `config.ts` — public runtime configuration validation.
- `navigation.ts` / `navigation-controller.ts` — trusted URL and external navigation policy.
- `native-lifecycle.ts` — Capacitor lifecycle, deep-link and Android back-button listeners.
- `bridge.ts` / `web-bridge-events.ts` — versioned web/native bridge contract.
- `diagnostics.ts` — safe diagnostics helpers.

The existing ChatPalez PHP/Smarty application remains responsible for social-network business logic and server-rendered mobile screens during the first release.
