import { defineConfig } from 'vite';
import vituum from 'vituum';
import nunjucks from '@vituum/vite-plugin-nunjucks';
import twig from '@vituum/vite-plugin-twig';
import postcss from '@vituum/vite-plugin-postcss';
import avifWebp from './vite-plugins/avif-webp.js';

export default defineConfig({
  build: {
    assetsInlineLimit: 0,
  },
  plugins: [vituum(), twig(), nunjucks(), postcss(), avifWebp()],
  server: {
    allowedHosts: ['fogrew.ngrok-free.dev'],
  },
});
