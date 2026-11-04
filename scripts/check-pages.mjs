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
 const {frameworkItems,frameworkSources}=await server.ssrLoadModule('/src/InvestmentFramework.jsx');
 assert.equal(new Set(frameworkItems.map(item=>item.id)).size,frameworkItems.length);
 for(const item of frameworkItems){assert(item.claim&&item.mechanism&&item.test&&item.sources.length);for(const id of item.sources)assert.equal(new URL(frameworkSources[id].url).protocol,'https:');for(const axis of ['x','y','z'])assert(Number.isFinite(item[axis])&&Math.abs(item[axis])<=1);}
 const centre=frameworkItems.find(item=>item.id==='near');assert.deepEqual([centre.x,centre.y,centre.z],[0,0,0]);
 assert(rendered['thesis.html'].includes('Illustrative positioning, not a score'));
 const convergence=rendered['thesis.html'].split('id="thesis-proposition-title"')[1].split('class="investment-framework"')[0];
 assert(convergence.includes('AI can decide what to do. Acting on those decisions is a different problem.'));
 assert(convergence.includes('NEAR’s proposition is to connect machine intent with execution across blockchain networks.'));
 assert(!convergence.includes('kinetic-cell'));
 assert.equal((rendered['thesis.html'].match(/class="kinetic-statement"/g)||[]).length,2);
 assert(!rendered['thesis.html'].includes('<h3>NEAR</h3>'));
 for(const removed of ['Front view','Depth view','Framework and competing explanations','is-orbiting','framework-sources','>HYPE<'])assert(!rendered['thesis.html'].includes(removed));
 assert.equal(topics.length,8);
 assert(!topics.some(topic=>['Revenue','Products','Ecosystem','Capital & liquidity','DeFi markets'].includes(topic.title)));
 assert(rendered['thesis.html'].indexOf('id="network"')<rendered['thesis.html'].indexOf('id="thesis-data-title"'));
 assert(!rendered['thesis.html'].includes('Awaiting supplied data.'));
 assert(rendered['thesis.html'].indexOf('id="framework-title"')<rendered['thesis.html'].indexOf('id="approach-title"'));
 assert(rendered['thesis.html'].indexOf('id="approach-title"')<rendered['thesis.html'].indexOf('id="network"'));
 const {glanceCharts,glanceGroups}=await server.ssrLoadModule('/src/DuneGlance.jsx');
 assert.equal(glanceCharts.length,9);assert.equal(new Set(glanceCharts.map(chart=>chart.id)).size,9);assert.equal(glanceGroups.length,5);
 for(const chart of glanceCharts){assert(/^\d+$/.test(chart.query)&&/^\d+$/.test(chart.visualization));assert(chart.title&&chart.description);}
 for(const group of glanceGroups){for(const id of group.chartIds)assert(glanceCharts.some(chart=>chart.id===id));const chart=glanceCharts.find(chart=>chart.id===group.chartIds[0]);assert(rendered['thesis.html'].includes('https://dune.com/queries/'+chart.query+'/'+chart.visualization));assert(rendered['thesis.html'].includes('https://dune.com/embeds/'+chart.query+'/'+chart.visualization));}
 assert(!rendered['thesis.html'].includes('thesis-dither-art'));
 assert(!rendered['thesis.html'].includes('Skip to overview'));
 assert(!rendered['thesis.html'].includes('Architecture references'));
 assert(rendered['thesis.html'].includes('NEAR at a glance'));
 assert(rendered['thesis.html'].indexOf('id="thesis-proposition-title"')<rendered['thesis.html'].indexOf('id="network"'));
 assert.equal(new Set(topics.map(topic=>topic.title)).size,8);
 assert(rendered['research.html'].includes('id="model-controls"'));
 assert(rendered['thesis.html'].includes('NEAR overview'));
 assert(rendered['thesis.html'].includes('Intelligence'));
 assert(rendered['thesis.html'].includes('meets execution.'));
 assert(rendered['thesis.html'].indexOf('id="thesis-title"')<rendered['thesis.html'].indexOf('id="network"'));
 for(const removed of ['A different kind of network user','Explore the network before judging the investment case','NEAR’s thesis begins where AI decisions meet blockchain execution','From proposition to evidence','proto-picker'])assert(!rendered['thesis.html'].includes(removed));
 for(const removed of ['Hover or touch a category','Topic map · not to scale','tidal-subtopics'])assert(!rendered['thesis.html'].includes(removed));
 assert(rendered['thesis.html'].includes('Chain Signatures'));
 assert(!rendered['thesis.html'].includes('Snapshot ·'));
 assert.equal(renderToStaticMarkup(createElement(Story)),rendered['thesis.html'],'The topic geometry must remain deterministic');
 const topicMarkup=rendered['thesis.html'].match(/<div class="tidal-topics"[^>]*>(.*?)<\/div>/s)?.[1];assert(topicMarkup);assert.equal((topicMarkup.match(/aria-pressed="false"/g)||[]).length,8,'All eight categories start in overview mode');
 console.log('All React pages render, IDs and local links resolve, UTF-8 text and text-only topic map preserved.');
}finally{await server.close();}
