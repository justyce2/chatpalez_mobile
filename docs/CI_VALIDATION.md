# CI Validation Policy

Every change on `develop` should pass the repository Mobile CI workflow before it is treated as build-verified.

The workflow checks:

1. Node.js 22 environment.
2. Dependency installation.
3. TypeScript type checking.
4. Vite production build.
5. Capacitor doctor/configuration checks.

Native Android and iOS build verification is a separate gate because Android requires the generated Gradle project and iOS requires Xcode/macOS.
