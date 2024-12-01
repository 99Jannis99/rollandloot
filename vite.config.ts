import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
  envDir: '.',
  resolve: {
    alias: {
      '@icons': path.resolve(__dirname, './public/icons')
    }
  }
});