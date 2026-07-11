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
      // Internal page used by the video recorder — not for search engines
      filter: (page) => !page.includes('/render/'),
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
