// Metro config for the Wudly monorepo.
// Lets Metro resolve workspace packages (e.g. @wudly/shared) and the shared
// node_modules hoisted to the repo root by pnpm.
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

// 1. Watch only what apps/mobile actually depends on: the workspace package
// (@wudly/shared) and the hoisted root node_modules — NOT the whole monorepo.
// Watching sibling apps (api/web/extension/gemma) previously made Metro's
// file-map crash on unrelated file-lock churn there (e.g. an EBUSY on
// apps/extension/node_modules/esbuild) and slowed the initial scan a lot.
config.watchFolders = [
  path.resolve(monorepoRoot, 'packages/shared'),
  path.resolve(monorepoRoot, 'node_modules'),
];

// 2. Resolve modules from the app first, then the hoisted root node_modules.
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(monorepoRoot, 'node_modules'),
];

// 3. pnpm uses symlinks; Metro must follow them.
config.resolver.unstable_enableSymlinks = true;
config.resolver.disableHierarchicalLookup = false;

module.exports = config;
