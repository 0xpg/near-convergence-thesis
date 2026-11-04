import assert from 'node:assert/strict';
import {existsSync,readFileSync} from 'node:fs';
import {createServer} from 'vite';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
const server=await createServer({server:{middlewareMode:true},appType:'custom'});
try{
 const pages=await server.ssrLoadModule('/src/pages.jsx');
 const {default:Story}=await server.ssrLoadModule('/src/ThesisPage.jsx');
 const {topics}=await server.ssrLoadModule('/src/OverviewScene.jsx');
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
 assert.equal(topics.length,8);
 assert(!topics.some(topic=>['Revenue','Products','Ecosystem','Capital & liquidity','DeFi markets'].includes(topic.title)));
 assert(rendered['thesis.html'].indexOf('id="network"')<rendered['thesis.html'].indexOf('id="thesis-data-title"'));
 assert(rendered['thesis.html'].includes('Awaiting supplied data.'));
 assert(!rendered['thesis.html'].includes('thesis-dither-art'));
 assert.equal(new Set(topics.map(topic=>topic.title)).size,8);
 for(const topic of topics){assert(topic.children.length>=2);assert.equal(new Set(topic.children).size,topic.children.length);assert(topic.children.every(title=>typeof title==='string'&&title.trim()));}
 assert(rendered['research.html'].includes('id="model-controls"'));
 assert(rendered['thesis.html'].includes('NEAR overview'));
 assert(rendered['thesis.html'].includes('Intelligence'));
 assert(rendered['thesis.html'].includes('meets execution.'));
 assert(rendered['thesis.html'].indexOf('id="thesis-title"')<rendered['thesis.html'].indexOf('id="network"'));
 for(const removed of ['A different kind of network user','Explore the network before judging the investment case','NEAR’s thesis begins where AI decisions meet blockchain execution','From proposition to evidence','proto-picker'])assert(!rendered['thesis.html'].includes(removed));
 assert(rendered['thesis.html'].includes('Hover or touch a category'));
 assert(rendered['thesis.html'].includes('Chain Signatures'));
 assert(!rendered['thesis.html'].includes('Snapshot ·'));
 assert.equal(renderToStaticMarkup(createElement(Story)),rendered['thesis.html'],'The topic geometry must remain deterministic');
 assert.equal((rendered['thesis.html'].match(/aria-pressed="false"/g)||[]).length,8,'All eight categories start in overview mode');
 console.log('All React pages render, IDs and local links resolve, UTF-8 text and text-only topic map preserved.');
}finally{await server.close();}
