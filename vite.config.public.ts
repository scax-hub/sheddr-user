import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3001, // Different from admin port
  },
  build: {
    outDir: 'dist-public',
  },
}); 