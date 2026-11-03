import {defineConfig} from 'vite';
export default defineConfig({publicDir:'.vite-public',build:{outDir:'dist-prototype',rollupOptions:{input:'prototype.html'}},server:{host:'127.0.0.1'}});
