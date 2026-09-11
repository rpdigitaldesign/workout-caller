// Vitest doesn't build under Next.js's "react-server" resolution condition,
// so the real `server-only` package (which unconditionally throws outside
// that condition) can't be imported as-is in tests. This no-op stub is
// aliased in vitest.config.ts so modules that `import 'server-only'` can
// still be unit-tested directly.
export {};
