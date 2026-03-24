import { defineConfig } from 'vite';
import glsl from 'vite-plugin-glsl';

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
        port: 7826,
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

    plugins: [glsl({
        include: [
            // Glob pattern, or array of glob patterns to import
            "**/*.glsl",
            "**/*.wgsl",
            "**/*.vert",
            "**/*.frag",
            "**/*.vs",
            "**/*.fs",
        ],
        exclude: undefined, // Glob pattern, or array of glob patterns to ignore
        warnDuplicatedImports: true, // Warn if the same chunk was imported multiple times
        defaultExtension: "glsl", // Shader suffix when no extension is specified
        watch: true, // Recompile shader on change
        root: "/src/graphics/nodes", // Directory for root imports
    })],
});
