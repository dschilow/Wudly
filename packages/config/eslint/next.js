import { baseConfig } from './base.js';
import tseslint from 'typescript-eslint';
import globals from 'globals';

/**
 * ESLint flat config for the Next.js frontend.
 * @type {import('typescript-eslint').ConfigArray}
 */
export const nextConfig = tseslint.config(...baseConfig, {
  languageOptions: {
    globals: {
      ...globals.browser,
      ...globals.node,
    },
  },
  rules: {
    // Server Components / client boundaries make some console usage acceptable in dev.
    'no-console': ['warn', { allow: ['warn', 'error'] }],
  },
});

export default nextConfig;
