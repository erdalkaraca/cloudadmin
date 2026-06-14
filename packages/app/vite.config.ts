import path, { dirname } from 'path';
import { fileURLToPath } from 'url';
import { defineConfig, loadEnv } from 'vite';
import { createDocksPwaPlugin } from '@eclipse-docks/extension-pwa/vite';
import crossOriginIsolation from 'vite-plugin-cross-origin-isolation';
import mkcert from 'vite-plugin-mkcert';
import { appSplashPlugin } from '@eclipse-docks/core/vite-plugin-app-splash';
import { resolveDepVersionsPlugin } from '@eclipse-docks/core/vite-plugin-resolve-deps';
import { localAliasesPlugin } from '@eclipse-docks/core/vite-plugin-local-aliases';

const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, __dirname, '');
  const basePath = env.VITE_BASE_PATH || '/';

  return {
  root: __dirname,
  base: basePath,
  assetsInclude: [
    '**/companion/vendor/bin/cloudadmin-companion',
    '**/companion/vendor/bin/cloudadmin-companion.exe',
  ],
  resolve: {},
  server: {
    watch: {
      ignored: ['**/node_modules/**', '**/dist/**'],
    },
  },
  plugins: [
    appSplashPlugin(),
    /** Side-effect-imports every `extension-*` / `@scope/extension-*` direct dependency from package.json (virtual module before main). */
    resolveDepVersionsPlugin(),
    localAliasesPlugin({
      useSrcInDev: true,
      alwaysUseSrc: true,
      patterns: [{ folderPrefix: 'extension-' }],
    }),
    mkcert(),
    crossOriginIsolation(),
    createDocksPwaPlugin({
      basePath,
      appName: 'cloudadmin',
      appDescription: 'cloudadmin – Application built with Eclipse Docks.',
      maximumFileSizeToCacheInBytes: 12 * 1024 * 1024,
    }),
  ],
  worker: {
    format: 'es',
  },
  build: {
    outDir: path.resolve(__dirname, 'dist'),
    assetsInlineLimit: 0,
    rolldownOptions: {
      input: {
        main: path.resolve(__dirname, 'index.html'),
      },
    },
  },
};
});
