import {mkdirSync,copyFileSync,readdirSync,readFileSync,lstatSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const fingerprint=JSON.parse(readFileSync(path.join(root,'report-source.json'),'utf8'));
for(const [file,hash] of Object.entries(fingerprint)) {
  if(createHash('sha256').update(readFileSync(path.join(root,file))).digest('hex')!==hash) throw new Error('Report is stale: rebuild with python scripts/report.py after analysis. Changed: '+file);
}
function copy(relative) {
  const source=path.join(root,relative), target=path.join(root,'dist',relative);
  if(lstatSync(source).isSymbolicLink()) throw new Error('Symlinks are not build inputs');
  if(lstatSync(source).isDirectory()) {
    mkdirSync(target,{recursive:true});
    for(const name of readdirSync(source)) copy(path.join(relative,name));
  } else { mkdirSync(path.dirname(target),{recursive:true}); copyFileSync(source,target); }
}
const pages=['index.html','thesis.html','explore.html','lab.html','report.html','research.html','methodology.html'];
for(const file of [...pages,'fonts.css','landing.css','cinematic.mjs','styles.css','app.mjs','report.pdf','assets','analysis/model.mjs','data']) copy(file);
for(const page of pages) {
const html=readFileSync(path.join(root,page),'utf8');
for(const [,url] of html.matchAll(/(?:href|src)="([^"]+)"/g)) {
  if(/^(https?:|mailto:|data:)/.test(url)) continue;
  const [target,fragment]=url.split('#');
  const file=path.join(root,'dist',(target||page).split('?')[0]);
  if(!existsSync(file)) throw new Error('Missing local link: '+url);
  if(fragment && file.endsWith('.html') && !readFileSync(file,'utf8').includes('id="'+fragment+'"')) throw new Error('Missing section: '+page+' -> '+url);
}
}
console.log('Built dist/: static site, documented snapshots, shared engine and synchronized report.');
