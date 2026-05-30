import { nextConfig } from '@wudly/config/eslint/next';

export default [
  ...nextConfig,
  {
    ignores: ['.next/**', 'node_modules/**', 'next-env.d.ts'],
  },
];
