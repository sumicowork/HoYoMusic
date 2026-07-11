/**
 * ESLint config for the HoYoMusic desktop app (Tauri + React 19 + Vite).
 *
 * NOTE: This directory currently has no ESLint, @typescript-eslint, or
 * eslint-plugin-react-hooks installed (no package.json / devDependencies yet).
 * The config below is intentionally minimal but VALID so it will not break
 * the build. To enable full TypeScript + React-Hooks linting, install:
 *
 *   npm i -D eslint @typescript-eslint/parser @typescript-eslint/eslint-plugin eslint-plugin-react-hooks
 *
 * and then replace `extends` / `parser` with the commented block below.
 */
module.exports = {
  root: true,
  env: {
    browser: true,
    es2021: true,
    node: true,
  },
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
    ecmaFeatures: { jsx: true },
  },
  extends: ['eslint:recommended'],
  // Full setup (requires the packages listed above):
  // parser: '@typescript-eslint/parser',
  // extends: [
  //   'eslint:recommended',
  //   'plugin:@typescript-eslint/recommended',
  //   'plugin:react-hooks/recommended',
  // ],
  rules: {
    'no-unused-vars': 'warn',
  },
  ignorePatterns: ['dist', 'node_modules', 'src-tauri/target', 'src-tauri/gen'],
};
