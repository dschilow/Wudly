import { nestConfig } from '@wudly/config/eslint/nest';

export default [
  ...nestConfig,
  {
    ignores: ['dist/**', 'node_modules/**', 'prisma/migrations/**'],
  },
];
