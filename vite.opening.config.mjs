import {defineConfig} from 'vite';
export default defineConfig({publicDir:false,build:{outDir:'dist-opening',rollupOptions:{input:'opening.html'}},server:{host:'127.0.0.1'}});
