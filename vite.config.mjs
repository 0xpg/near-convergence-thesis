import {defineConfig} from 'vite';
export default defineConfig({
  publicDir:'.vite-public',
  esbuild:{jsx:'automatic'},
  build:{rollupOptions:{input:['index','thesis','explore','lab','report','research','methodology'].map(page=>page+'.html')}},
  server:{host:'127.0.0.1'}
});
