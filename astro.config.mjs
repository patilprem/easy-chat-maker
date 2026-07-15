import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import tailwind from '@astrojs/tailwind';
import sitemap from '@astrojs/sitemap';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const projectRoot = dirname(fileURLToPath(import.meta.url));

// https://astro.build/config
export default defineConfig({
  site: 'https://easychatmaker.com',
  integrations: [
    react(),
    tailwind(),
    sitemap({
      // Internal pages — not for search engines: the video recorder's render
      // target and the export-stats dashboard
      filter: (page) => !page.includes('/render/') && !page.includes('/stats'),
    }),
  ],
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
