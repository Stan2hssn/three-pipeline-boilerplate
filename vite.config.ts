import { defineConfig } from 'vite';

export default defineConfig({
    resolve: {
        alias: {
            '@': '/src',
            '@_core': '/src/_core',
            '@graphics': '/src/graphics',
            '@postprocessing': '/src/graphics/postprocessing',
            '@runtime': '/src/graphics/runtime',
            '@universes': '/src/graphics/universes',
            '@adapters': '/src/graphics/adapters',
        },
    },
    server: {
        port: 5173,
    },
    build: {
        outDir: 'dist',
        assetsDir: 'assets',
        sourcemap: true,
        minify: true,
        target: 'es2022',
        chunkSizeWarningLimit: 1000,
        rollupOptions: {
            output: {
                manualChunks(id) {
                    if (id.includes('node_modules/three')) {
                        return 'three';
                    }
                    if (id.includes('node_modules/postprocessing')) {
                        return 'postprocessing';
                    }
                }
            },
        },
    },
});
