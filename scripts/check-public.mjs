import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync,existsSync,readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
mkdirSync('dist-public',{recursive:true});writeFileSync('dist-public/stale-check.txt','must disappear');
execFileSync(process.execPath,['scripts/build.mjs','--public'],{stdio:'inherit'});
for(const file of ['stale-check.txt','assets/fonts','assets/vendor/p5-2.3.3.min.js','.git','.env','.wrangler'])assert(!existsSync('dist-public/'+file),file+' must not be published');
assert(!readFileSync('dist-public/fonts.css','utf8').includes('@font-face'));
assert.deepEqual(readFileSync('dist-public/report.pdf'),readFileSync('report.pdf'));
console.log('Clean public output, font exclusion and PDF integrity passed.');
