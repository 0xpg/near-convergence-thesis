import assert from 'node:assert/strict';
import {existsSync,readFileSync} from 'node:fs';
import {createServer} from 'vite';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
const server=await createServer({server:{middlewareMode:true},appType:'custom'});
try{
 const pages=await server.ssrLoadModule('/src/pages.tsx');
 const {default:Story}=await server.ssrLoadModule('/src/ThesisPage.tsx');
 const {topics}=await server.ssrLoadModule('/src/OverviewScene.tsx');
 const components={'index.html':pages.Landing,'lab.html':pages.Lab,'thesis.html':Story};
 const routeFiles={'/':'index.html','/thesis':'thesis.html','/scenario-labs':'lab.html'};
 const {routes,resolveRoute}=await server.ssrLoadModule('/src/routes.ts');
 assert.deepEqual(Object.keys(routes).sort(),Object.keys(routeFiles).sort());
 for(const route of Object.values(routes))assert(route.title.includes('Near Convergence Thesis'),'Website title must use renamed project');
 for(const [legacy,path] of [['/thesis.html','/thesis'],['/index.html','/'],['/scenario-labs/','/scenario-labs'],['/','/']])assert.equal(resolveRoute(legacy).path,path);
 for(const legacy of ['/explore','/report','/research','/methodology'])assert.equal(resolveRoute(legacy).redirect,'/thesis');
 assert.equal(resolveRoute('/lab').redirect,'/scenario-labs');assert.equal(resolveRoute('/lab.html').redirect,'/scenario-labs');
 const rendered=Object.fromEntries(Object.entries(components).map(([file,Component])=>[file,renderToStaticMarkup(createElement(Component))]));
 assert(rendered['lab.html'].includes('<footer class="thesis-finale" aria-labelledby="lab-finale-title">')&&rendered['lab.html'].includes('<span>Convergence</span>'),'Scenario Lab closes with the shared Convergence wordmark');
 assert(rendered['lab.html'].indexOf('class="lab-footer"')>rendered['lab.html'].indexOf('id="lab-finale-title"')&&rendered['lab.html'].includes('Dated observations, explicit assumptions and reproducible valuation sensitivities.'),'Original footer identity remains below the wordmark');
 for(const label of ['Choose a case. Trace its value.','Bear','Base','Bull','Maximum','Operating assumptions to token value','Where the price comes from','Export complete model'])assert(rendered['lab.html'].includes(label),'Lab model missing '+label);
 assert(!rendered['lab.html'].includes('What would $400–$500 require?'));
 assert(rendered['lab.html'].includes('calibrated upside hypothesis'),'Maximum calibration must be explicit');
 assert(!rendered['lab.html'].includes('Mock data'));
 assert(!rendered['lab.html'].match(/<footer[\s\S]*Sources &amp; methodology/),'Lab footer must not retain methodology link');
 for(const label of ['The economics<br/>behind the price.','Selected-case variables and evidence status','30D / 90D operating cross-check','Maximum reference at','https://arxiv.org/abs/2403.04914','https://docs.near-intents.org/resources/fees'])assert(rendered['lab.html'].includes(label),'Visible valuation framework missing '+label);
 assert(rendered['lab.html'].includes('2026-11-10')&&rendered['lab.html'].includes('224353535'),'Lab evidence cutoffs must be visible');
 const {default:CaseLab}=await server.ssrLoadModule('/src/lab/LabExperience.tsx');
 const {heatColors}=await server.ssrLoadModule('/src/lab/ValuationPanel.tsx');
 const {STARTING:caseStarting,VAL_DEFAULTS:caseDefaults,HOLDINGS_BASELINE_ID:holdingsBaselineId}=await server.ssrLoadModule('/src/lab/baseline.ts');
 const {MODEL_VERSION:caseVersion,buildValuationCases:makeCases,runValuation:caseRun}=await server.ssrLoadModule('/src/lab/valuation.ts');
 const {transmissionMetrics,commitAssumptionValue}=await server.ssrLoadModule('/src/lab/Transmission.tsx');
 const {assumptionGroups}=await server.ssrLoadModule('/src/lab/AssumptionControls.tsx');
 for(const marker of ['Where the growth cases sit in the record.','Fees have not compressed; capture has risen.','The multiple and the hurdle against outside evidence.','Realized vs Base, 3 months after each origin','Out of sample, centred but too narrow.','The same case under historical volatility.','data/lab-rigor.json','10–90% growth band'])assert(rendered['lab.html'].includes(marker),'Rigor layer missing '+marker);
 const {simulateBand,SIGMA_MONTHLY:bandSigma}=await server.ssrLoadModule('/src/lab/uncertainty.ts');
 {
  const reference=(await server.ssrLoadModule('/src/lab/valuation.ts')).runValuation(caseDefaults,caseStarting);
  const band=simulateBand(reference.inputs,reference.starting);
  assert.equal(band.months,reference.rows.length-1,'Band aligns with the model path');
  assert(bandSigma>0&&band.sigma===bandSigma);
  for(let m=0;m<=band.months;m++)assert(band.rev.q10[m]<=band.rev.q50[m]+1e-9&&band.rev.q50[m]<=band.rev.q90[m]+1e-9,'Quantiles ordered');
  assert(band.terminal.q10<band.terminal.q50&&band.terminal.q50<band.terminal.q90,'Terminal quantiles ordered');
  assert(Math.abs(band.rev.q50[band.months]/reference.terminal.totalUsd-1)<.12,'Median path tracks the deterministic case');
  assert(band.rev.q90[band.months]>band.rev.q50[band.months]*1.2,'Band is materially wide at the horizon');
  const again=simulateBand({...reference.inputs},reference.starting);
  assert.deepEqual(again,band,'Seeded band is reproducible');
  const bear=simulateBand({...reference.inputs,growthPct:-1},reference.starting);
  assert(bear.terminal.q50<band.terminal.q50,'Band responds to the growth input');
 }
 const {modelHash,readModelHash,modelExport}=await server.ssrLoadModule('/src/lab/model-state.ts');
 const rawBaseline=JSON.parse(readFileSync('data/lab-baseline.json','utf8'));
 const rawInstitutional=JSON.parse(readFileSync('data/institutional-demand.json','utf8'));
 for(const c of makeCases(caseStarting)){
  const model={valuation:c.inputs,referenceCase:c.id};
  const expectedHash='#s='+encodeURIComponent(JSON.stringify({model:caseVersion,baseline:rawBaseline.version,holdingsBaseline:holdingsBaselineId,referenceCase:c.id,valuation:c.inputs}));
  assert.equal(modelHash(model),expectedHash,'Share URLs retain their exact serialized format');
  assert.deepEqual(readModelHash(expectedHash),model,'Every case round-trips without changed inputs');
  const result=caseRun(c.inputs,caseStarting),metrics=transmissionMetrics(result),cases=makeCases(caseStarting),exportedAt='2026-11-14T00:00:00.000Z';
  const expected={exportedAt,model:caseVersion,baseline:rawBaseline,institutionalHoldingsBaseline:{source:'https://nrretf.com/',snapshot:rawInstitutional.version,issuerDate:rawInstitutional.nrr.holdingsIssuerDate,nearHeld:rawInstitutional.nrr.nearHeld,scope:'NRR tracked fund inventory, not total institutional ownership'},referenceCase:c.id,selectedCase:c.id,valuation:c.inputs,valuationOutputs:result,transmission:metrics,valuationCases:cases};
  assert.equal(JSON.stringify(modelExport(model,result,metrics,cases,c.id,exportedAt)),JSON.stringify(expected),'Export values and property order remain compatible');
 }
 for(const hash of ['', '#s=%', '#s=null', '#s='+encodeURIComponent(JSON.stringify({model:caseVersion,baseline:'wrong'}))])assert.equal(readModelHash(hash),null,'Untrusted malformed or incompatible links fall back safely');

 const nonHoldings=Object.keys(caseDefaults).filter(k=>!['exitDate','institutionalHoldingsPct','holdingsElasticity'].includes(k));
 assert.deepEqual(assumptionGroups.flatMap(g=>[...g.fields]).sort(),nonHoldings.sort(),'Every non-ETF assumption has one primary group');
 assert.equal(commitAssumptionValue('26.3','discountPct',caseDefaults).discountPct,26.3);
 assert.equal(commitAssumptionValue('15.862722163309982','grossBps',caseDefaults).grossBps,15.862722163309982);
 for(const raw of ['',' ','NaN','Infinity'])assert.equal(commitAssumptionValue(raw,'discountPct',caseDefaults),caseDefaults,'Invalid exact entry keeps prior assumptions');
 assert.equal(commitAssumptionValue('1000','institutionalHoldingsPct',caseDefaults).institutionalHoldingsPct,80);
 const caseBaseline=JSON.parse(readFileSync('data/lab-baseline.json','utf8'));
 const oldLocation=Object.getOwnPropertyDescriptor(globalThis,'location');
 const caseMoney=n=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',notation:'compact',maximumFractionDigits:1}).format(n);
 const casePrice=n=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:2}).format(n);
 const caseClose=(a,b)=>assert(Math.abs(a-b)<=Math.max(1e-7,Math.abs(b)*1e-10),'Case transmission accounting');
 try{
  const referenceCases=makeCases(caseStarting),custom={...referenceCases.at(-1).inputs,aiTokenLinkPct:0};
  for(const input of [...referenceCases.map(c=>c.inputs),custom,{...referenceCases[1].inputs,institutionalHoldingsPct:5},{...referenceCases[1].inputs,institutionalHoldingsPct:0}]){
   Object.defineProperty(globalThis,'location',{configurable:true,value:{hash:'#s='+encodeURIComponent(JSON.stringify({model:caseVersion,baseline:caseBaseline.version,holdingsBaseline:holdingsBaselineId,valuation:input}))}});
   const html=renderToStaticMarkup(createElement(CaseLab)),r=caseRun(input,caseStarting),t=r.terminal,m=transmissionMetrics(r);
   const hero=html.match(/<section class="lab-hero"[\s\S]*?<\/section>/)?.[0];
   const summary=html.match(/<section id="lab"[\s\S]*?<\/section>/)?.[0];
   const lower=html.match(/<section class="lab-models lab-transmission"[\s\S]*?<\/section>/)?.[0];
   const framework=html.match(/<section class="lab-models lab-framework"[\s\S]*?<\/section>/)?.[0];
   assert(framework&&framework.includes(casePrice(t.futurePriceUsd))&&framework.includes(casePrice(t.presentPriceUsd)),'Visible equations follow selected valuation');
   assert(!framework.includes('lab-card-meta'),'Framework must not restore redundant upper labels');
   assert(framework.includes('lab-accrual-map')&&framework.includes('Combined annual REV'),'Connected calculation map must render');
   const years=(Date.parse(input.exitDate)-Date.parse(caseStarting.asOf))/86400000/365,volume=caseStarting.annualVolumeUsd*(1+input.growthPct/100)**(12*years),fee=input.grossBps*Math.max(volume/caseStarting.annualVolumeUsd,1)**-input.compression;
   const execution=volume*fee/10000*input.capturePct/100*(1-input.costPct/100),institution=input.institutionalVolumeAnnualUsd*input.institutionalFeeBps/10000*input.institutionalCapturePct/100*(1-input.costPct/100),ai=input.aiRevenueAnnualUsd*input.aiMarginPct/100*input.aiTokenLinkPct/100,supply=caseStarting.supplyNear*(1+input.issuancePct/100)**years;
   const revAnchor=(execution+institution+ai)*input.multiple/supply,reconstructed=revAnchor*((supply-caseStarting.institutionalHoldingsNear)/(supply-supply*input.institutionalHoldingsPct/100))**(1/input.holdingsElasticity);
   caseClose(t.futurePriceUsd,reconstructed);caseClose(t.presentPriceUsd,reconstructed/(1+input.discountPct/100)**years);
   assert(hero&&summary&&lower,'One hero, selected-case summary and transmission section required');
   for(const section of [hero,summary]){assert(section.includes(caseMoney(t.totalUsd)),'Selected case REV must propagate');assert(section.includes(casePrice(t.futurePriceUsd)),'Selected price must propagate');}
   assert(hero.includes(`${input.multiple}×`));
   for(const value of [t.intentsUsd,t.institutionalUsd,t.aiUsd])assert(lower.includes(caseMoney(value)),'Lower charts must reflect selected components');
   assert(framework.includes(casePrice(t.revenuePriceUsd))&&framework.includes('Holdings demand factor'),'Formula map must separate REV anchor from holdings demand');
   assert(html.includes('ETF holdings adjustment')&&html.includes(casePrice(t.holdingsImpactUsd)),'Price bridge must include positive and negative holdings effects');
   assert.equal((html.match(/aria-label="Valuation cases"/g)||[]).length,1,'One case selector');
   assert.equal((html.match(/type="range"/g)||[]).length,nonHoldings.length+2,'One slider per numeric assumption');
   assert.equal((html.match(/type="number"/g)||[]).length,nonHoldings.length+2,'One exact entry per numeric assumption');
   assert(!html.includes('Transmission cases')&&!html.includes('Capital that chooses to stay.'),'Independent ETF panel and duplicate selector removed');
   assert(html.indexOf('id="lab"')<html.indexOf('id="valuation-title"'),'Working controls precede results');
   assert(html.indexOf('Where the price comes from')<html.indexOf('Adjust ETF holdings'),'ETF adjustment follows price bridge');
   assert(html.includes('<div class="lab-deep-dive">')&&!html.includes('<details class="lab-deep-dive"'),'Full framework is shown without a toggle');
   assert(html.includes('<details class="lab-reference lab-method">'),'Reference table is clearly separate and collapsed');
   assert(!lower.includes('type="range"')&&!lower.includes('type="number"'),'Transmission charts do not duplicate controls');
   caseClose(m.coreGrossUsd,m.uncapturedUsd+m.costsUsd+m.coreCapturedUsd);
   caseClose(m.coreCapturedUsd+t.aiUsd,t.totalUsd);
   caseClose(m.volumeUsd,t.volumeUsd+t.institutionalVolumeUsd);
   for(const obsolete of ['Assumption sensitivity','Illustrative mix','Issuance covered','incompatible baseline or invalid assumptions','Observed starting scale','NEAR price'])assert(!html.includes(obsolete),'Obsolete independent model UI: '+obsolete);
  }
  Object.defineProperty(globalThis,'location',{configurable:true,value:{hash:'#s=%7Bbad-json'}});
  const safe=renderToStaticMarkup(createElement(CaseLab));assert(safe.includes(casePrice(caseRun(caseDefaults,caseStarting).terminal.futurePriceUsd)),'Malformed links use safe defaults');
  Object.defineProperty(globalThis,'location',{configurable:true,value:{hash:'#s='+encodeURIComponent(JSON.stringify({model:caseVersion,baseline:caseBaseline.version,holdingsBaseline:'different-source',valuation:custom}))}});
  assert(renderToStaticMarkup(createElement(CaseLab)).includes(casePrice(caseRun(caseDefaults,caseStarting).terminal.futurePriceUsd)),'Changed holdings sources must not silently rerun old links');
  const legacy={...referenceCases[1].inputs};delete legacy.institutionalHoldingsPct;delete legacy.holdingsElasticity;
  Object.defineProperty(globalThis,'location',{configurable:true,value:{hash:'#s='+encodeURIComponent(JSON.stringify({model:'near-lab-v3',baseline:caseBaseline.version,valuation:legacy}))}});
  assert(renderToStaticMarkup(createElement(CaseLab)).includes(casePrice(referenceCases[1].result.terminal.revenuePriceUsd)),'Legacy v3 links migrate to neutral holdings');
  const modified={...referenceCases[1].inputs,institutionalHoldingsPct:5,discountPct:26.3};
  Object.defineProperty(globalThis,'location',{configurable:true,value:{hash:'#s='+encodeURIComponent(JSON.stringify({model:caseVersion,baseline:caseBaseline.version,holdingsBaseline:holdingsBaselineId,referenceCase:'base',valuation:modified}))}});
  const modifiedHtml=renderToStaticMarkup(createElement(CaseLab));assert(modifiedHtml.includes('Base Scenario · modified')&&modifiedHtml.includes('Changes from Base'),'Shared model retains reference lineage');
  assert(modifiedHtml.includes(casePrice(caseRun(modified,caseStarting).terminal.futurePriceUsd)),'Lineage metadata does not change arithmetic');
  Object.defineProperty(globalThis,'location',{configurable:true,value:{hash:'#s='+encodeURIComponent(JSON.stringify({model:caseVersion,baseline:caseBaseline.version,holdingsBaseline:holdingsBaselineId,referenceCase:'not-a-case',valuation:modified}))}});
  assert(renderToStaticMarkup(createElement(CaseLab)).includes(casePrice(caseRun(modified,caseStarting).terminal.futurePriceUsd)),'Invalid lineage cannot change valid numerical inputs');
  Object.defineProperty(globalThis,'location',{configurable:true,value:{hash:'#s='+encodeURIComponent(JSON.stringify({model:caseVersion,baseline:caseBaseline.version,holdingsBaseline:holdingsBaselineId,referenceCase:null,valuation:referenceCases[1].inputs}))}});
  assert(renderToStaticMarkup(createElement(CaseLab)).includes('Custom Scenario'),'Explicit unknown lineage must not invent a starting case on reload');
 }finally{if(oldLocation)Object.defineProperty(globalThis,'location',oldLocation);else delete globalThis.location;}
 for(let i=0;i<=200;i++)assert(heatColors(i/200).contrast>=4.5,'Heatmap label contrast');
 for(const [page,html] of Object.entries(rendered)){
  assert(!/\u00e2\u20ac|\u00c2\u00b7/.test(html),'UTF-8 text: '+page);
  const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(match=>match[1]);
  assert.equal(new Set(ids).size,ids.length,'Duplicate IDs: '+page);
  for(const [,url] of html.matchAll(/(?:href|src)="([^"]+)"/g)){
   if(/^(https?:|mailto:|data:)/.test(url))continue;
   const [target,fragment]=url.split('#'),route=target?routeFiles[target.split('?')[0]]:page,file=route||(target||page).split('?')[0].replace(/^\//,'');
   assert(route?rendered[route]:existsSync('dist/'+file),'Missing '+page+' -> '+url);
   if(fragment&&rendered[file])assert(rendered[file].includes('id="'+fragment+'"'),'Missing anchor '+url);
  }
 }
 const {frameworkItems,frameworkSources}=await server.ssrLoadModule('/src/InvestmentFramework.tsx');
 assert.equal(new Set(frameworkItems.map(item=>item.id)).size,frameworkItems.length);
 for(const item of frameworkItems){assert(item.claim&&item.mechanism&&item.test&&item.sources.length);for(const id of item.sources)assert.equal(new URL(frameworkSources[id].url).protocol,'https:');for(const axis of ['x','y','z'])assert(Number.isFinite(item[axis])&&Math.abs(item[axis])<=1);}
 assert(frameworkItems.some(item=>item.id==='institutional'&&item.title==='Institutional demand'));
 assert(!rendered['thesis.html'].includes('From expectations to mechanisms'));
 assert(!rendered['thesis.html'].includes('NEAR is centred as the hypothesis'));
 const centre=frameworkItems.find(item=>item.id==='near');assert.deepEqual([centre.x,centre.y,centre.z],[0,0,0]);
 assert(rendered['thesis.html'].includes('Illustrative positioning, not a score'));
 const convergence=rendered['thesis.html'].split('id="thesis-proposition-title"')[1].split('class="investment-framework"')[0];
 assert(convergence.includes('AI is a tool that helps augment human work'));
 assert(convergence.includes('institutional capital is moving onchain'));
 assert.equal((convergence.match(/<li>/g)||[]).length,5);
 assert(convergence.includes('<strong>We believe the asymmetric opportunity sits in the infrastructure'));
 assert(convergence.includes('<strong>Given these attributes, blockchain will be pivotal'));
 assert.equal((convergence.match(/<strong>/g)||[]).length,2);
 assert(!rendered['thesis.html'].includes('<p>Investment framework</p>'));
 assert(!rendered['thesis.html'].includes('All categories'));
 assert(rendered['thesis.html'].includes('thesis-chapter-divider'));
 assert(rendered['thesis.html'].includes('The systems'));
 assert(rendered['thesis.html'].includes('A proposition'));
 assert(convergence.includes('the “killer” use case that drives blockchain adoption.'));
 assert(!convergence.includes('AI can decide what to do.'));
 assert(!convergence.includes('kinetic-cell'));
 assert.equal((rendered['thesis.html'].match(/class="kinetic-statement"/g)||[]).length,2);
 assert(!rendered['thesis.html'].includes('<h3>NEAR</h3>'));
 for(const removed of ['Front view','Depth view','Framework and competing explanations','is-orbiting','framework-sources','>HYPE<'])assert(!rendered['thesis.html'].includes(removed));
 assert.equal(topics.length,10);
 assert(!topics.some(topic=>['Revenue','Products','Ecosystem','Capital & liquidity','DeFi markets'].includes(topic.title)));
 assert(rendered['thesis.html'].indexOf('id="network"')<rendered['thesis.html'].indexOf('id="thesis-data-title"'));
 assert(!rendered['thesis.html'].includes('Awaiting supplied data.'));
 assert(rendered['thesis.html'].indexOf('id="framework-title"')<rendered['thesis.html'].indexOf('id="approach-title"'));
 assert(rendered['thesis.html'].indexOf('id="approach-title"')<rendered['thesis.html'].indexOf('id="network"'));
 const {default:DuneGlance,glanceCharts,glanceGroups,glanceInsights}=await server.ssrLoadModule('/src/DuneGlance.tsx');
 const missingInsights=renderToStaticMarkup(createElement(DuneGlance,{insights:{},economics:false}));
 assert(!missingInsights.includes('class="glance-takeaway"'),'Missing evidence must not retain an investment interpretation');
 assert(missingInsights.includes('Snapshot insight unavailable.'),'Missing is distinct from zero');
 assert(!existsSync('dist-public/scripts/glance-stress.html'),'Stress fixtures must stay local');
 const dashboardVisuals=JSON.parse(readFileSync('analysis/defillama-ir/sql/dashboard-visuals.json','utf8')).visualizations;
 const counters=new Set(['13129722','13129725','13129731','13129732','13129757']);
 const expanded=JSON.parse(readFileSync('data/glance-coverage.json','utf8'));
 const flywheel=JSON.parse(readFileSync('data/intents-flywheel.json','utf8'));
 const institutional=JSON.parse(readFileSync('data/institutional-demand.json','utf8'));
 const flywheelIds=['fee-productivity','public-participation','public-pairs','public-patterns'];
 assert.deepEqual(flywheel.charts.map(chart=>chart.id).sort(),[...flywheelIds].sort());
 const allowed=new Set([...dashboardVisuals.map(v=>v.query+'/'+v.visualization),...flywheel.charts.map(v=>v.query+'/'+v.visualization),...institutional.charts.map(v=>v.query+'/'+v.visualization),...expanded.sources.flatMap(source=>(source.visualizations||[]).map(v=>source.query.split('/').at(-1)+'/'+v))]);
 for(const chart of glanceCharts)assert(allowed.has(chart.query+'/'+chart.visualization));
 for(const source of expanded.sources)for(const visual of source.visualizations||[])assert(glanceCharts.some(chart=>source.query.endsWith('/'+chart.query)&&chart.visualization===visual),'Expanded Dune chart must reach website');
 assert(rendered['thesis.html'].includes('https://dune.com/0xpanatagama/near-economic\"'));
 assert(!rendered['thesis.html'].includes('<a class="glance-chart"'));
 const chartFrames=rendered['thesis.html'].match(/<iframe[^>]+Dune visualization[^>]*>/g)||[];
 assert.equal(chartFrames.length,14);
 for(const frame of chartFrames){assert(!frame.includes('aria-hidden'));assert(!frame.includes('tabindex="-1"'));}
 assert.equal(glanceCharts.length,32);assert.equal(new Set(glanceCharts.map(chart=>chart.id)).size,32);assert.equal(glanceGroups.length,14);
 assert.equal(glanceGroups.flatMap(group=>group.chartIds).length,32);
 const insightData={insights:glanceInsights};
 for(const chart of glanceCharts){assert(insightData.insights[chart.id]);const snapshot=insightData.insights[chart.id].snapshot;if(snapshot)assert(existsSync('dist/'+snapshot));}assert(!rendered['thesis.html'].includes('Network fundamentals'));
 for(const insight of Object.values(insightData.insights)){assert(insight.value&&insight.headline&&insight.date&&insight.limitation&&insight.calculation.method);assert.equal(new URL(insight.source).protocol,'https:');}
 assert(rendered['thesis.html'].includes('Download calculations'));
 const glanceTiles=rendered['thesis.html'].match(/<article class="glance-tile[\s\S]*?<\/article>/g)||[];
 assert.equal(glanceTiles.length,15);
 assert(rendered['thesis.html'].includes('Intents flywheel'));
 const rigor=JSON.parse(readFileSync('data/intents-flywheel-rigor.json','utf8'));
 assert.equal(glanceInsights['fee-productivity'].value,'$'+Math.round(rigor.financial.summary.currentFeePerMillionUsd).toLocaleString('en-US'));
 assert(glanceInsights['fee-productivity'].takeaway.includes('−$'+Math.round(Math.abs(rigor.financial.summary.reportingMix.netVolumeMixEffectPerMillionUsd)).toLocaleString('en-US')));
 assert(!glanceInsights['public-participation'].calculation.method.includes('single-hash'));
 for(const id of flywheelIds)assert.equal(glanceInsights[id].research,'data/intents-flywheel-rigor.json');
 assert(rendered['thesis.html'].includes('Download research &amp; validation'));
 for(const id of flywheelIds){
  const group=glanceGroups.find(group=>group.id===id),chart=glanceCharts.find(chart=>chart.id===id);
  assert.deepEqual(group.chartIds,[id],'Flywheel findings must be independent visible defaults');
  assert(flywheel.charts.some(source=>source.id===id&&source.query===chart.query&&source.visualization===chart.visualization),'Flywheel embed must match its source manifest');
  assert.equal(glanceTiles.filter(tile=>tile.includes('id="glance-'+id+'-title"')).length,1,'Exactly one visible card per flywheel finding');
  assert(glanceInsights[id].snapshot==='data/intents-flywheel.json','Flywheel insights must point to their own validated snapshot');
 }

 assert.equal(glanceTiles.filter(tile=>tile.includes('id="glance-institutional-title"')).length,1);
 assert.deepEqual(glanceGroups.find(group=>group.id==='institutional').chartIds,['investment-holdings','investment-units','investment-flows']);
 assert.equal(glanceInsights['investment-units'].value,(institutional.european.change.sharesChangePct<0?'−':'+')+Math.abs(institutional.european.change.sharesChangePct).toFixed(1)+'%');
 assert(glanceInsights['investment-holdings'].date.includes(institutional.nrr.holdingsIssuerDate)&&glanceInsights['investment-holdings'].date.includes(institutional.european.issuerDate));
 assert.equal(institutional.nrr.verifiedNetFlowUsd,null);
 assert.equal(institutional.european.verifiedInstitutionalOwnershipPct,null);
 assert(glanceInsights['investment-holdings'].limitation.includes('No combined holdings total'));
 assert.equal(glanceInsights['investment-holdings'].snapshot,'data/institutional-demand.json');
 const flows=glanceInsights['investment-flows'];
 assert.equal(flows.value,(institutional.flowSummary.cumulativeNetFlowUsd<0?'−$':'$')+new Intl.NumberFormat('en-US',{notation:'compact',maximumFractionDigits:1}).format(Math.abs(institutional.flowSummary.cumulativeNetFlowUsd)));
 assert.equal(flows.attribution.url,institutional.flowSummary.sourceUrl);
 assert.equal(flows.snapshot,undefined,'Provider excerpt must not offer a data export');
 assert(flows.takeaway.includes(institutional.flowSummary.firstThreeSessionsShareOfLatestCumulativePct.toFixed(1)+'%'));
 assert(flows.date.includes(institutional.flowSummary.start)&&flows.date.includes(institutional.flowSummary.end));
 const attributed=renderToStaticMarkup(createElement(DuneGlance,{insights:{'investment-holdings':flows},economics:false}));
 const attributedTile=(attributed.match(/<article class="glance-tile[\s\S]*?<\/article>/g)||[]).find(tile=>tile.includes('id="glance-institutional-title"'));
 assert(attributedTile.includes('Source: <a href="'+flows.attribution.url+'"'),'Provider attribution renders its source link');
 assert(attributedTile.indexOf('Source:')<attributedTile.indexOf('<details>'),'Provider attribution remains visible outside evidence details');
 const institutionalTile=glanceTiles.find(tile=>tile.includes('id="glance-institutional-title"'));
 assert.equal((institutionalTile.match(/href="data\/institutional-demand.json"/g)||[]).length,1,'Same source and research download must not duplicate links');
 assert(rendered['thesis.html'].includes('Observed economics'));
 assert(rendered['thesis.html'].includes('data/glance-daily.json'));
 assert(rendered['thesis.html'].includes('Observed analysis window'));
 for(const tile of glanceTiles){
  assert(tile.indexOf('class="glance-chart"')<tile.indexOf('class="glance-takeaway"'),'Interpretation follows its chart');
  assert.equal((tile.match(/<details>/g)||[]).length,1,'Evidence stays local to its card');
 }
 assert(readFileSync('src/dune-glance.css','utf8').includes('gap:24px;align-items:start'),'Evidence must not stretch neighbouring cards');
 assert(rendered['thesis.html'].includes('does not recalculate the snapshot insight'));
 for(const chart of glanceCharts){assert(/^\d+$/.test(chart.query)&&/^\d+$/.test(chart.visualization));assert(chart.title&&chart.description);}
 for(const group of glanceGroups){for(const id of group.chartIds)assert(glanceCharts.some(chart=>chart.id===id));const chart=glanceCharts.find(chart=>chart.id===group.chartIds[0]);assert(rendered['thesis.html'].includes('https://dune.com/queries/'+chart.query+'/'+chart.visualization));assert(rendered['thesis.html'].includes('https://dune.com/embeds/'+chart.query+'/'+chart.visualization));}
 assert(!rendered['thesis.html'].includes('thesis-dither-art'));
 assert(!rendered['thesis.html'].includes('Skip to overview'));
 assert(!rendered['thesis.html'].includes('Architecture references'));
 assert(rendered['thesis.html'].includes('NEAR at a glance'));
 assert(rendered['thesis.html'].indexOf('id="thesis-proposition-title"')<rendered['thesis.html'].indexOf('id="network"'));
 assert.equal(new Set(topics.map(topic=>topic.title)).size,10);
 assert(rendered['thesis.html'].includes('NEAR overview'));
 assert(rendered['thesis.html'].includes('Intelligence'));
 assert(rendered['thesis.html'].includes('meets execution.'));
 assert(rendered['thesis.html'].indexOf('id="thesis-title"')<rendered['thesis.html'].indexOf('id="network"'));
 for(const removed of ['A different kind of network user','Explore the network before judging the investment case','NEAR’s thesis begins where AI decisions meet blockchain execution','From proposition to evidence','proto-picker'])assert(!rendered['thesis.html'].includes(removed));
 for(const removed of ['Hover or touch a category','Topic map · not to scale','tidal-subtopics'])assert(!rendered['thesis.html'].includes(removed));
 assert(rendered['thesis.html'].includes('Chain Signatures'));
 assert(!rendered['thesis.html'].includes('Snapshot ·'));
 assert.equal(renderToStaticMarkup(createElement(Story)),rendered['thesis.html'],'The topic geometry must remain deterministic');
 const topicMarkup=rendered['thesis.html'].match(/<div class="tidal-topics"[^>]*>(.*?)<\/div>/s)?.[1];assert(topicMarkup);assert.equal((topicMarkup.match(/aria-pressed="false"/g)||[]).length,10,'All ten categories start in overview mode');
 console.log('All React pages render, IDs and local links resolve, UTF-8 text and text-only topic map preserved.');
}finally{await server.close();}
