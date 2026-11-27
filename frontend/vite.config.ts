import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// https://vitejs.dev/config/
export default defineConfig({
    plugins: [react()],
    resolve: {
        alias: {
            '@': path.resolve(__dirname, './src'),
        },
    },
    build: {
        rollupOptions: {
            output: {
                manualChunks(id) {
                    if (!id.includes('node_modules')) return;
                    if (id.includes('recharts') || id.includes('victory')) return 'charts';
                    if (id.includes('@radix-ui')) return 'radix';
                    if (id.includes('@tanstack')) return 'query';
                    if (id.includes('date-fns') || id.includes('/d3-')) return 'dates';
                },
            },
        },
    },
    server: {
        host: true,
        allowedHosts: true,
        proxy: {
            '^/api/': {
                target: 'http://localhost:3005',
                changeOrigin: true,
            },
        },
    },
});
