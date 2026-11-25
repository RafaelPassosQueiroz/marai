import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => ({
    plugins: [react()],
    base: mode === 'cloudflare' ? '/' : '/marai/',
    ...(mode === 'cloudflare' && {
        build: { outDir: 'dist-cloudflare' },
    }),
    server: {
        host: '127.0.0.1',
        port: 5173,
        strictPort: true,
        proxy: { '/api': 'http://127.0.0.1:8001' },
    },
}));