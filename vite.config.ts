import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig(() => {
  return {
    base: '/',
    plugins: [
      react(),
      tailwindcss(),
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
