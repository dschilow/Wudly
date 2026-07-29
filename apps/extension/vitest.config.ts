import { defineConfig } from 'vitest/config';

/**
 * Adapter tests run against a real DOM (happy-dom): shop pages are the one
 * input this extension does not control, and every production bug so far came
 * from a page state nobody had thought of — stale JSON-LD, an SPA that swaps
 * the URL before the DOM, a ProductGroup wrapper instead of a Product node.
 * Those states are cheap to reproduce as HTML fixtures and expensive to debug
 * live in a shop.
 */
export default defineConfig({
  test: {
    environment: 'happy-dom',
    include: ['src/**/*.spec.ts'],
  },
});
