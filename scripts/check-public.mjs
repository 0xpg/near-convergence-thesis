import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync,existsSync,readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
mkdirSync('dist-public',{recursive:true});writeFileSync('dist-public/stale-check.txt','must disappear');
execFileSync(process.execPath,['scripts/build.mjs','--public'],{stdio:'inherit'});
for(const file of ['stale-check.txt','ambient.mjs','assets/audio/quiet-infrastructure.mp3','assets/vendor/p5-2.3.3.min.js','.git','.env','.wrangler','node_modules','src','app.mjs','story.mjs'])assert(!existsSync('dist-public/'+file),file+' must not be published');
assert(readFileSync('dist-public/styles/fonts.css','utf8').includes('@font-face'));
for(const font of ['Saans-TRIAL-Regular.otf','Saans-TRIAL-Medium.otf','Saans-TRIAL-SemiBold.otf','SaansMono-TRIAL-Regular.otf'])assert.deepEqual(readFileSync('dist-public/assets/fonts/'+font),readFileSync('assets/fonts/'+font));
assert.deepEqual(readFileSync('dist-public/report.pdf'),readFileSync('report.pdf'));
console.log('Clean public output, supplied font integrity and PDF integrity passed.');

const html=readFileSync('dist-public/index.html','utf8');assert(html.includes('id="root"'));assert(!html.includes('/src/main.tsx'));assert(/assets\/index-[^"]+\.js/.test(html));
for(const page of ['thesis','lab','research','methodology'])assert(!existsSync('dist-public/'+page+'.html'),'Pages are routed from index.html');
const redirects=readFileSync('dist-public/_redirects','utf8');for(const page of ['thesis','lab','research','methodology'])assert(redirects.includes('/'+page+'.html /'+page+' 301')&&redirects.includes('/'+page+' /index.html 200'));
assert(!/^\/index\.html\s+\/\s+301$/m.test(redirects),'Do not redirect the SPA rewrite target back to the homepage');
