import {mkdirSync,copyFileSync,readdirSync,readFileSync,lstatSync,existsSync,rmSync} from 'node:fs';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const publicBuild=process.argv.includes('--public'),output=publicBuild?'dist-public':'dist';
const fingerprint=JSON.parse(readFileSync(path.join(root,'report-source.json'),'utf8'));
for(const [file,hash] of Object.entries(fingerprint)) {
  if(createHash('sha256').update(readFileSync(path.join(root,file))).digest('hex')!==hash) throw new Error('Report is stale: rebuild with python scripts/report.py after analysis. Changed: '+file);
}
const outputPath=path.resolve(root,output);
if(path.dirname(outputPath)!==root||!['dist','dist-public'].includes(path.basename(outputPath)))throw new Error('Invalid build output path');
if(existsSync(outputPath)&&lstatSync(outputPath).isSymbolicLink())throw new Error('Build output must not be a symlink');
rmSync(outputPath,{recursive:true,force:true});
function copy(relative) {
  const source=path.join(root,relative), target=path.join(root,output,relative);
  if(lstatSync(source).isSymbolicLink()) throw new Error('Symlinks are not build inputs');
  if(lstatSync(source).isDirectory()) {
    mkdirSync(target,{recursive:true});
    for(const name of readdirSync(source)) copy(path.join(relative,name));
  } else { mkdirSync(path.dirname(target),{recursive:true}); copyFileSync(source,target); }
}
const pages=['index.html','thesis.html','explore.html','lab.html','report.html','research.html','methodology.html'];
for(const file of [...pages,'fonts.css','landing.css','cinematic.mjs','story.mjs','story.css','story-frames.mjs','favicon.ico','styles.css','app.mjs','report.pdf','assets','analysis/model.mjs','data','_headers']) copy(file);
for(const page of pages) {
const html=readFileSync(path.join(root,page),'utf8');
for(const [,url] of html.matchAll(/(?:href|src)="([^"]+)"/g)) {
  if(/^(https?:|mailto:|data:)/.test(url)) continue;
  const [target,fragment]=url.split('#');
  const file=path.join(root,output,(target||page).split('?')[0]);
  if(!existsSync(file)) throw new Error('Missing local link: '+url);
  if(fragment && file.endsWith('.html') && !readFileSync(file,'utf8').includes('id="'+fragment+'"')) throw new Error('Missing section: '+page+' -> '+url);
}
}
console.log(`Built ${output}/: static site, documented snapshots, shared engine and synchronized report.`);
