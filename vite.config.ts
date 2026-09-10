import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(() => {
  return {
    base: '/',
    plugins: [
      react(),
      tailwindcss(),
      VitePWA({ 
        registerType: 'autoUpdate',
        manifest: false, // We use the manual manifest.json in public/
        workbox: {
          skipWaiting: true,
          clientsClaim: true,
          globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
          runtimeCaching: [
            {
              urlPattern: /^https:\/\/.*\.tile\.openstreetmap\.org\/.*$/,
              handler: 'CacheFirst',
              options: {
                cacheName: 'osm-map-tiles-v1',
                expiration: {
                  maxEntries: 2000,
                  maxAgeSeconds: 30 * 24 * 60 * 60,
                },
                cacheableResponse: {
                  statuses: [0, 200],
                },
              },
            },
            {
              urlPattern: /^https:\/\/server\.arcgisonline\.com\/ArcGIS\/rest\/services\/World_Imagery\/.*$/,
              handler: 'CacheFirst',
              options: {
                cacheName: 'esri-satellite-tiles-v1',
                expiration: {
                  maxEntries: 2000,
                  maxAgeSeconds: 30 * 24 * 60 * 60,
                },
                cacheableResponse: {
                  statuses: [0, 200],
                },
              },
            },
            {
              urlPattern: /^https:\/\/.*\.tile\.opentopomap\.org\/.*$/,
              handler: 'CacheFirst',
              options: {
                cacheName: 'opentopo-map-tiles-v1',
                expiration: {
                  maxEntries: 2000,
                  maxAgeSeconds: 30 * 24 * 60 * 60,
                },
                cacheableResponse: {
                  statuses: [0, 200],
                },
              },
            },
          ],
        }
      })
    ],
    optimizeDeps: {
      include: [
        'react',
        'react-dom',
        'leaflet',
        'lucide-react',
        'motion/react',
        'firebase/app',
        'firebase/firestore',
        'firebase/auth'
      ],
    },
    server: {
      hmr: false,
      port: 3000,
      host: '0.0.0.0',
    },
    build: {
      outDir: 'dist',
      emptyOutDir: true,
      sourcemap: true,
    }
  };
});
