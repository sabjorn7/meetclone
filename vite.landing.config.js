// Standalone build for the meetgu.ru marketing landing — fully isolated from the app.
// Entry: landing.html → src/_landing/main.js → LandingApp (LandingPage + static header + footer).
// Output: dist-landing/ (nginx roots meetgu.ru here). Shares public/ for /images and /video assets.
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import autoprefixer from 'autoprefixer';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
    plugins: [vue()],
    resolve: {
        alias: { '@': path.resolve(__dirname, 'src') },
    },
    publicDir: path.resolve(__dirname, 'public'),
    css: {
        postcss: { plugins: [autoprefixer()] },
    },
    build: {
        outDir: path.resolve(__dirname, 'dist-landing'),
        emptyOutDir: true,
        rollupOptions: {
            input: {
                main: path.resolve(__dirname, 'landing.html'),        // meetgu.ru/
                onas: path.resolve(__dirname, 'onas.html'),           // meetgu.ru/onas
                spikeram: path.resolve(__dirname, 'spikeram.html'),   // meetgu.ru/spikeram
                uchenikam: path.resolve(__dirname, 'uchenikam.html'), // meetgu.ru/uchenikam
                uchz: path.resolve(__dirname, 'uchz.html'),           // meetgu.ru/uchz
            },
        },
    },
});
