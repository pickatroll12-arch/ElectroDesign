import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base './' permite abrir la app desde file:// (Electron) y desde cualquier
// subcarpeta de un servidor web.
export default defineConfig({
  base: './',
  plugins: [react()],
  build: { target: 'es2022', chunkSizeWarningLimit: 1500 },
});
