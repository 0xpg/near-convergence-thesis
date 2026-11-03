import assert from 'node:assert/strict';
import {existsSync,readFileSync} from 'node:fs';
import {createServer} from 'vite';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
const server=await createServer({server:{middlewareMode:true},appType:'custom'});
try{
 const pages=await server.ssrLoadModule('/src/pages.jsx');
 const {default:Story}=await server.ssrLoadModule('/src/OverviewScene.jsx');
 const components={'index.html':pages.Landing,'lab.html':pages.Lab,'report.html':pages.Report,'research.html':pages.Research,'methodology.html':pages.Methodology,'thesis.html':Story};
 const rendered=Object.fromEntries(Object.entries(components).map(([file,Component])=>[file,renderToStaticMarkup(createElement(Component))]));
 for(const [page,html] of Object.entries(rendered)){
  assert(!/\u00e2\u20ac|\u00c2\u00b7/.test(html),'UTF-8 text: '+page);
  const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(match=>match[1]);
  assert.equal(new Set(ids).size,ids.length,'Duplicate IDs: '+page);
  for(const [,url] of html.matchAll(/(?:href|src)="([^"]+)"/g)){
   if(/^(https?:|mailto:|data:)/.test(url))continue;
   const [target,fragment]=url.split('#'),file=(target||page).split('?')[0];
   assert(existsSync('dist/'+file),'Missing '+page+' -> '+url);
   if(fragment&&rendered[file])assert(rendered[file].includes('id="'+fragment+'"'),'Missing anchor '+url);
  }
 }
 assert(rendered['research.html'].includes('id="model-controls"'));
 assert(rendered['thesis.html'].includes('NEAR at a glance'));
 console.log('All React pages render, IDs and local links resolve, UTF-8 text and single-slide overview preserved.');
}finally{await server.close();}
