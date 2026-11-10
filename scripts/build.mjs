import {mkdirSync,copyFileSync,readdirSync,readFileSync,lstatSync,existsSync,rmSync} from 'node:fs';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {build,createServer} from 'vite';
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
const staging=path.join(root,'.vite-public');
if(existsSync(staging)&&lstatSync(staging).isSymbolicLink())throw new Error('Public staging must not be a symlink');
rmSync(staging,{recursive:true,force:true});
function copy(relative) {
  const source=path.join(root,relative),target=path.join(staging,relative);
  if(lstatSync(source).isSymbolicLink())throw new Error('Symlinks are not build inputs');
  if(lstatSync(source).isDirectory()){
    mkdirSync(target,{recursive:true});for(const name of readdirSync(source))copy(path.join(relative,name));
  }else{mkdirSync(path.dirname(target),{recursive:true});copyFileSync(source,target);}
}
for(const file of ['styles','favicon.ico','report.pdf','assets','analysis/model.mjs','data','_headers'])copy(file);
if(process.argv.includes('--dev')){
  const server=await createServer();await server.listen();server.printUrls();
}else{
  await build({build:{outDir:output}});
  console.log(`Built ${output}/: React website, documented snapshots, shared engine and synchronized PDF.`);
}
