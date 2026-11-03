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
 assert(rendered['thesis.html'].includes('NEAR overview'));
 assert(rendered['thesis.html'].includes('Hover or touch a category'));
 assert(rendered['thesis.html'].includes('AI &amp; agents'));
 assert(!rendered['thesis.html'].includes('Snapshot ·'));
 assert.equal(renderToStaticMarkup(createElement(Story)),rendered['thesis.html'],'The topic geometry must remain deterministic');
 assert.equal((rendered['thesis.html'].match(/aria-pressed="false"/g)||[]).length,10,'All ten categories start in overview mode');
 console.log('All React pages render, IDs and local links resolve, UTF-8 text and text-only topic map preserved.');
}finally{await server.close();}
