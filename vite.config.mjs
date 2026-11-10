import {defineConfig} from 'vite';
export default defineConfig({
  publicDir:'.vite-public',
  esbuild:{jsx:'automatic'},
  build:{rollupOptions:{input:'index.html'}},
  server:{host:'127.0.0.1'}
});
