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

for(const page of ['index','thesis','lab','research','methodology']){const html=readFileSync('dist-public/'+page+'.html','utf8');assert(html.includes('id="root"'));assert(!html.includes('/src/main.jsx'));assert(/assets\/main-[^"]+\.js/.test(html));}
