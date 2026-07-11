import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// Resolve the repo root from this file: backend/tests -> backend -> repo root.
const currentDir = (() => {
  try {
    return dirname(fileURLToPath(import.meta.url));
  } catch {
    // CJS fallback (no type:module in backend/package.json).
    return __dirname;
  }
})();
const repoRoot = resolve(currentDir, '..', '..');

const openapiPath = join(repoRoot, 'openapi', 'openapi.json');
const generatedPath = join(repoRoot, 'frontend', 'src', 'generated', 'api-types.ts');

const hasOpenapi = existsSync(openapiPath);
const hasGenerated = existsSync(generatedPath);

// A component schema from openapi-typescript output appears as an indented
// `Name: {` property key inside `export interface components { schemas: { ... } }`.
function isSchemaDeclared(text: string, name: string): boolean {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp('(^|\\n)[ \\t]*' + escaped + '[ \\t]*:[ \\t]*\\{', 'm');
  return re.test(text);
}

describe('API contract: OpenAPI spec ↔ generated desktop client types', () => {
  if (!hasOpenapi) {
    // Spec is authoritative; without it we cannot assert sync -> skip, never fail.
    it.skip(
      `openapi.json not found at ${openapiPath} — skipping contract check`,
      () => {},
    );
    return;
  }

  it('every component schema in openapi.json is present in generated api-types.ts', () => {
    const spec = JSON.parse(readFileSync(openapiPath, 'utf8'));
    const schemas = spec?.components?.schemas ?? {};
    const expectedNames = Object.keys(schemas);

    expect(
      expectedNames.length,
      'openapi.json defines no component schemas; nothing to sync against',
    ).toBeGreaterThan(0);

    if (!hasGenerated) {
      throw new Error(
        `Generated API types file is MISSING at:\n  ${generatedPath}\n` +
          `It must export component schema types for: ${expectedNames.join(', ')}`,
      );
    }

    const generatedText = readFileSync(generatedPath, 'utf8');

    const missing = expectedNames.filter(
      (name) => !isSchemaDeclared(generatedText, name),
    );

    if (missing.length > 0) {
      throw new Error(
        `Generated api-types.ts is missing the following component schema(s) ` +
          `defined in openapi.json (the desktop client types are out of sync):\n` +
          `  - ${missing.join('\n  - ')}\n` +
          `File: ${generatedPath}\n` +
          `Run the openapi-typescript generator to regenerate this file.`,
      );
    }

    // Redundant positive assertion for a clear failure message per schema.
    for (const name of expectedNames) {
      expect(
        isSchemaDeclared(generatedText, name),
        `Component schema "${name}" should be exported in api-types.ts`,
      ).toBe(true);
    }
  });

  it('generated api-types.ts exists', () => {
    expect(
      hasGenerated,
      `Generated API types file is missing at ${generatedPath}`,
    ).toBe(true);
  });
});
