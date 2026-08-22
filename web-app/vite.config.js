import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      output: {
        // فصل حزم Firebase عن كود التطبيق ليُخزَّن مؤقتاً بالمتصفح ويُحمَّل أسرع
        manualChunks: {
          'firebase-core': ['firebase/app', 'firebase/auth'],
          'firebase-data': ['firebase/firestore', 'firebase/storage', 'firebase/functions'],
          vendor: ['react', 'react-dom', 'react-router-dom'],
        },
      },
    },
  },
  server: {
    port: 5173,
    open: false,
  },
});
