import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import tailwind from '@astrojs/tailwind';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const projectRoot = dirname(fileURLToPath(import.meta.url));

// https://astro.build/config
export default defineConfig({
  integrations: [react(), tailwind()],
  devToolbar: {
    enabled: false,
  },
  output: 'static',
  server: {
    host: true,
    port: 4321,
  },
  vite: {
    server: {
      host: true,
      allowedHosts: true,
      fs: {
        allow: [projectRoot],
      },
    },
  },
});
