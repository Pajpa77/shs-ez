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
          globPatterns: ['**/*.{js,css,html,ico,png,svg}']
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
