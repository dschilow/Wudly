import { PrismaClient } from '@prisma/client';

/**
 * Shared PrismaClient for integration tests. Tests run against the local dev
 * database (DATABASE_URL from apps/api/.env). They are read-mostly and clean up
 * any rows they create.
 */
export const testPrisma = new PrismaClient();

/** A unique suffix so test-created rows never collide across runs. */
export function uniqueSuffix(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
