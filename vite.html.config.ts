import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';

// Compila toda la app en un solo archivo HTML (dist-html/index.html), sin
// archivos anexos: se abre con doble clic en cualquier navegador, sin instalar
// nada ni levantar un servidor.
export default defineConfig({
  base: './',
  plugins: [
    react(),
    viteSingleFile({ removeViteModuleLoader: true }),
    {
      // El manifiesto y el icono son archivos aparte: aquí no existen.
      name: 'sin-enlaces-externos',
      transformIndexHtml: (html) => html.replace(/\s*<link rel="(manifest|icon)"[^>]*>/g, ''),
    },
  ],
  publicDir: false,
  build: { target: 'es2022', outDir: 'dist-html', chunkSizeWarningLimit: 4000 },
});
