import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// `standalone` output produces a small, self-contained server bundle for Docker
// (used on Railway / Linux). It relies on symlinks, which fail with EPERM on
// Windows without Developer Mode — so we only enable it when explicitly asked
// (the Dockerfile sets BUILD_STANDALONE=true). Local Windows dev builds skip it.
const useStandalone = process.env.BUILD_STANDALONE === 'true';

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // @wudly/shared is a workspace package shipped as compiled CJS+types; Next can
  // consume it directly, but transpiling keeps it robust across versions.
  transpilePackages: ['@wudly/shared'],
  ...(useStandalone
    ? {
        // Bundle only what's needed → small Docker image for Railway.
        output: 'standalone',
        // In a pnpm monorepo, trace from the repo root so workspace deps are included.
        outputFileTracingRoot: path.join(__dirname, '../../'),
      }
    : {}),
  eslint: {
    // Lint is run separately; don't fail production builds on lint.
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
