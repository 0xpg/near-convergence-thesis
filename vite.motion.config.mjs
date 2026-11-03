import {defineConfig} from 'vite';
export default defineConfig({publicDir:false,build:{outDir:'dist-motion',rollupOptions:{input:'motion.html'}},server:{host:'127.0.0.1'}});
