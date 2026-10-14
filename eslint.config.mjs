import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default [
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/.turbo/**',
      '.tmp/**',
      '.local/**',
      'playwright-report/**',
      'test-results/**',
      '**/coverage/**',
      'logo/doc-page.js',
      'logo/support.js',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: { globals: { ...globals.node, ...globals.browser } },
    rules: {
      'no-restricted-imports': ['error', { patterns: ['**/apps/*/src/**', '@tandara/*/src/**'] }],
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-explicit-any': 'error',
    },
  },
  {
    files: ['apps/*-web/**/*.{ts,tsx}', 'packages/ui/**/*.{ts,tsx}'],
    plugins: { 'react-hooks': reactHooks },
    rules: reactHooks.configs.recommended.rules,
  },
  {
    files: [
      'apps/*-web/**/*.{ts,tsx}',
      'packages/ui/**/*.{ts,tsx}',
      'packages/contracts/**/*.ts',
      'packages/api-client/**/*.ts',
    ],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            '@tandara/backend',
            '@tandara/backend/*',
            '@tandara/database',
            '@tandara/database/*',
            '@nestjs/*',
            'node:*',
            '@tandara/*/src/**',
            '**/apps/*/src/**',
          ],
        },
      ],
    },
  },
  prettier,
];
