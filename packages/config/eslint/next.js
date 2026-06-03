import { baseConfig } from './base.js';
import tseslint from 'typescript-eslint';
import globals from 'globals';
import nextPlugin from '@next/eslint-plugin-next';
import reactHooks from 'eslint-plugin-react-hooks';

/**
 * ESLint flat config for the Next.js frontend.
 *
 * Registers the Next.js and React Hooks plugins so their rules (and the
 * `eslint-disable @next/next/...` / `react-hooks/...` directives used across the
 * app) resolve instead of erroring with "Definition for rule … was not found".
 *
 * @type {import('typescript-eslint').ConfigArray}
 */
export const nextConfig = tseslint.config(...baseConfig, {
  plugins: {
    '@next/next': nextPlugin,
    'react-hooks': reactHooks,
  },
  languageOptions: {
    globals: {
      ...globals.browser,
      ...globals.node,
    },
  },
  rules: {
    ...nextPlugin.configs.recommended.rules,
    ...nextPlugin.configs['core-web-vitals'].rules,
    ...reactHooks.configs.recommended.rules,
    // Server Components / client boundaries make some console usage acceptable in dev.
    'no-console': ['warn', { allow: ['warn', 'error'] }],
  },
});

export default nextConfig;
