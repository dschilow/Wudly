import { baseConfig } from './base.js';
import tseslint from 'typescript-eslint';

/**
 * ESLint flat config for the NestJS backend.
 * Relaxes a few rules that conflict with Nest's decorator-heavy style.
 * @type {import('typescript-eslint').ConfigArray}
 */
export const nestConfig = tseslint.config(...baseConfig, {
  rules: {
    // Nest uses decorators and DI extensively; interfaces with empty bodies are common.
    '@typescript-eslint/no-empty-object-type': 'off',
    '@typescript-eslint/no-extraneous-class': 'off',
    // Constructor DI params are intentionally "unused" outside the constructor body.
    '@typescript-eslint/no-useless-constructor': 'off',
  },
});

export default nestConfig;
