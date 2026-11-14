import {mkdirSync,copyFileSync,readdirSync,readFileSync,lstatSync,existsSync,rmSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {build,createServer} from 'vite';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const publicBuild=process.argv.includes('--public'),output=publicBuild?'dist-public':'dist';
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
for(const file of ['styles','favicon.ico','assets','data','_headers','_redirects'])copy(file);
if(process.argv.includes('--dev')){
  const server=await createServer();await server.listen();server.printUrls();
}else{
  await build({build:{outDir:output}});
  console.log(`Built ${output}/: React website and documented snapshots.`);
}
