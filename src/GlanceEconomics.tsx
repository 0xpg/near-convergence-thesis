import {useState} from 'react';
import economics from '../data/glance-economics.json';
import type {WindowAnalysis} from './glance-analytics.ts';
import {ANALYTICS_VERSION} from './glance-analytics.ts';
import type {GlanceSnapshot} from './glance-data.ts';
import {DitherCanvas,ditherRect,ditherLine,text,rule,INK,MUTED,GREEN,SOFT,RED,AMBER} from './lab/dither.tsx';
import {formatUsdCompact} from './format.ts';

const usd=(v:number|null)=>v===null||!Number.isFinite(v)?'—':formatUsdCompact(v,2);
const pct=(v:number|null)=>v===null?'—':v.toFixed(1)+'%';
const period=(a:WindowAnalysis)=>a.window.start&&a.window.end?`${a.window.start} – ${a.window.end}`:'Unavailable source window';
const queries={scorecard:'https://dune.com/queries/9114284',waterfall:'https://dune.com/queries/9114284',daily:'https://dune.com/queries/9114284'};

export function GlanceScorecard({analysis,days,onDaysChange,end,onEndChange,maxDate,sourceVersion,retrievedAt,onRefresh,refreshing,refreshError}:{analysis:WindowAnalysis,days:number,onDaysChange:(days:number)=>void,end:string,onEndChange:(date:string)=>void,maxDate:string,sourceVersion:string,retrievedAt:string,onRefresh:()=>void,refreshing:boolean,refreshError:string|null}){
  const s=analysis.current;
  const age=Math.max(0,Math.floor((Date.now()-Date.parse(maxDate+'T00:00:00Z'))/86_400_000));
  const stats=s?[
    {label:'Intents volume',value:usd(s.volumeUsd),note:s.averageSwapUsd===null?'Average swap unavailable: incomplete counts':`${usd(s.averageSwapUsd)} average swap`},
    {label:'Captured per $1m',value:usd(s.retainedPerMillionUsd),note:`${s.capturedBps===null?'—':s.capturedBps.toFixed(2)} bps captured`},
    {label:'USD capture ratio',value:pct(s.captureSharePct),note:`${usd(s.capturedUsd)} receipts / ${usd(s.grossFeesUsd)} fees`},
    {label:'Revenue / issuance',value:pct(s.revenuePctIssuance),note:'Reported revenue relative to new NEAR; not a verified supply offset'},
    {label:'Daily transactions',value:s.averageDailyTransactions===null?'—':Math.round(s.averageDailyTransactions).toLocaleString('en-US'),note:'Base-chain average across this window'}
  ]:[];
  return <section className="glance-scorecard" aria-labelledby="glance-scorecard-title">
    <div className="glance-scorecard-head"><div><h3 id="glance-scorecard-title">Observed economics</h3><p>{period(analysis)} · completed UTC days</p></div>
      <div className="glance-window-controls"><div className="glance-switch" role="group" aria-label="Observed analysis window">{[30,90].map(value=><button key={value} aria-pressed={days===value} onClick={()=>onDaysChange(value)}>{value}D</button>)}</div><label>Through <input type="date" value={end} max={maxDate} onChange={event=>{if(event.target.value)onEndChange(event.target.value);}}/></label></div>
    </div>
    {s?<><dl className="glance-scorecard-grid">{stats.map(stat=><div key={stat.label}><dt>{stat.label}</dt><dd><strong>{stat.value}</strong><span>{stat.note}</span></dd></div>)}</dl><p className="glance-window-commentary" aria-live="polite">{analysis.headline}</p></>:<p className="glance-data-status" role="status">The selected window is incomplete. {analysis.quality.errors.join(' ')}</p>}
    <div className="glance-source-bar"><p>Source cutoff {maxDate||'unavailable'} · retrieved {retrievedAt} · {sourceVersion}. Window changes rerun calculations; they do not refresh upstream Dune queries.</p><button type="button" onClick={onRefresh} disabled={refreshing}>{refreshing?'Checking snapshot…':'Check latest snapshot'}</button></div>
    {age>2&&<p className="glance-data-status">Cached observations end {age} UTC days before today. This is a reproducible historical snapshot, not a live feed.</p>}
    {refreshError&&<p className="glance-data-status" role="status">{refreshError} {sourceVersion==='unavailable'?'No valid observation snapshot is available.':'The last validated snapshot remains available.'}</p>}
    {analysis.quality.warnings.length>0&&<details className="glance-quality"><summary>Coverage notes</summary><ul>{analysis.quality.warnings.map(item=><li key={item}>{item}</li>)}</ul></details>}
  </section>;
}

function drawWaterfall(a:WindowAnalysis){return (pen:CanvasRenderingContext2D,width:number,height:number)=>{
  const s=a.current;if(!s)return;
  if(s.volumeUsd===0){text(pen,'No traded volume in this window',width/2,height/2,{size:13,align:'center'});return;}
  const rows=[{label:'Gross fees',value:s.grossFeesUsd},{label:'Difference',value:-s.residualUsd},{label:'Captured receipts',value:s.capturedUsd}].map(row=>({...row,value:row.value/s.volumeUsd*1e6}));
  const max=Math.max(...rows.map(row=>Math.abs(row.value)),1),left=Math.min(145,width*.32),right=width-78,x=(v:number)=>left+v/max*(right-left),band=(height-56)/3;
  let running=0;rows.forEach((row,i)=>{const top=24+i*band,bar=Math.min(38,band*.55),y=top+(band-bar)/2;
    const from=i===2?0:Math.min(running,running+row.value),to=i===2?row.value:Math.max(running,running+row.value);
    ditherRect(pen,x(from),y,x(to)-x(from),bar,i===1?.55:.8,[SOFT,RED,GREEN][i]);text(pen,row.label,0,y+bar/2,{size:width<500?10:12,color:INK,baseline:'middle'});text(pen,usd(row.value),x(to)+7,y+bar/2,{size:12,color:INK,weight:500,baseline:'middle'});running+=row.value;
  });rule(pen,left,height-26,right,height-26);text(pen,'USD per $1m of reported volume',left,height-8,{size:10,color:MUTED});
};}

function drawDaily(a:WindowAnalysis){return (pen:CanvasRenderingContext2D,width:number,height:number)=>{
  const left=42,right=width-18,top=30,bottom=height-40;
  const points=a.series.map(row=>({day:row.day,gross:row.volumeUsd>0?row.grossFeesUsd/row.volumeUsd*1e4:null,captured:row.volumeUsd>0?row.capturedUsd/row.volumeUsd*1e4:null}));
  const max=Math.max(...points.flatMap(row=>[row.gross??0,row.captured??0]),1),y=(v:number)=>bottom-v/max*(bottom-top),x=(i:number)=>left+i/Math.max(points.length-1,1)*(right-left);
  for(let i=0;i<=4;i++){const value=max*i/4;rule(pen,left,y(value),right,y(value),'#293b3214');text(pen,value.toFixed(1),left-7,y(value)+4,{size:10,align:'right'});}
  for(const [key,tone] of [['gross',AMBER],['captured',GREEN]] as const){let run:[number,number][]=[];for(let i=0;i<points.length;i++){const value=points[i][key];if(value===null){if(run.length)ditherLine(pen,run,tone,1.5);run=[];}else run.push([x(i),y(value)]);}if(run.length)ditherLine(pen,run,tone,1.5);}
  text(pen,'Charged / volume',left,14,{size:10,color:AMBER});text(pen,'Captured / volume',left+118,14,{size:10,color:GREEN});text(pen,'bps',4,14,{size:10});
  if(points.length){text(pen,points[0].day,left,bottom+20,{size:10});text(pen,points[points.length-1].day,right,bottom+20,{size:10,align:'right'});}
};}

function drawDrivers(a:WindowAnalysis){return (pen:CanvasRenderingContext2D,width:number,height:number)=>{
  const d=a.decomposition;if(!d){text(pen,'A complete preceding window is required',width/2,height/2,{size:12,align:'center'});return;}
  const rows=[{label:'Volume',value:d.volumeEffectUsd},{label:'Capture rate',value:d.captureRateEffectUsd},{label:'Receipts change',value:d.totalChangeUsd}];
  const max=Math.max(...rows.map(row=>Math.abs(row.value)),1),left=Math.min(150,width*.34),right=width-68,mid=(left+right)/2,x=(v:number)=>mid+v/max*(right-left)/2,band=(height-70)/3;
  rule(pen,mid,24,mid,height-40);rows.forEach((row,i)=>{const y=35+i*band;ditherRect(pen,Math.min(mid,x(row.value)),y,Math.abs(x(row.value)-mid),26,.75,row.value<0?RED:GREEN);text(pen,row.label,0,y+18,{size:12,color:INK});text(pen,usd(row.value),row.value<0?x(row.value)-6:x(row.value)+6,y+18,{size:10,align:row.value<0?'right':'left',color:INK});});
  text(pen,'Symmetric attribution · not causal',left,height-12,{size:10});
};}

export function GlanceRetention({analysis,snapshot,available=true}:{analysis:WindowAnalysis,snapshot:GlanceSnapshot,available?:boolean}){
  const [view,setView]=useState<'waterfall'|'daily'|'drivers'>('waterfall');
  const views={waterfall:{tab:'Per $1m',draw:drawWaterfall(analysis),label:'Gross fees, unmatched difference and captured receipts per million dollars traded.',query:queries.waterfall},daily:{tab:'Daily rates',draw:drawDaily(analysis),label:'Daily gross-fee and captured-receipt rates in basis points of Intents volume.',query:queries.daily},drivers:{tab:'Change drivers',draw:drawDrivers(analysis),label:'Symmetric arithmetic decomposition of the captured receipts change into volume and capture-rate contributions.',query:queries.scorecard}};
  const current=views[view],ready=available&&analysis.status==='ready'&&analysis.current;
  return <article className="glance-tile glance-retention" aria-labelledby="glance-retention-title">
    <div className="glance-tile-head"><span className="glance-category">Economics</span><h4 id="glance-retention-title">From traded volume to captured receipts</h4>
      <div className="glance-switch" role="group" aria-label="Fee capture views">{Object.entries(views).map(([key,option])=><button key={key} aria-pressed={view===key} aria-controls="glance-retention-chart" onClick={()=>setView(key as typeof view)}>{option.tab}</button>)}</div>
      {ready?<div className="glance-insight" aria-live="polite"><strong>{view==='drivers'?usd(analysis.decomposition?.totalChangeUsd??null):pct(analysis.current!.captureSharePct)}</strong><p className="glance-observation">{view==='drivers'?'Captured USD receipts change against the preceding equal-length window.':'Captured USD receipts divided by gross USD fees across the selected window.'}</p></div>:<p role="status">Complete source observations are unavailable for this window.</p>}
    </div>
    <div className="glance-chart glance-native" id="glance-retention-chart">{ready?<DitherCanvas key={view} draw={current.draw} height="100%" label={current.label}/>:<p className="glance-data-status">No chart is inferred from missing data.</p>}</div>
    {ready&&<blockquote className="glance-takeaway" aria-live="polite">{analysis.commentary}</blockquote>}
    <footer className="glance-footer"><details><summary>Evidence & calculation</summary><p>{period(analysis)}. Numbers and charts use the same selected daily observations. The daily view is recalculated from the Intents, revenue and ecosystem query inputs; the linked Dune source may have a newer cutoff.</p><p>Capture ratio = sum of captured USD receipts / sum of gross USD fees. Captured rate = receipts / traded volume × 10,000. Receipts can arrive after fees accrue; gross less receipts is an unmatched accounting difference, not a verified partner-payment ledger.</p><p>The change decomposition allocates the interaction equally between volume and capture rate. It explains arithmetic, not causality. Revenue against issuance includes provider-classified revenue and does not establish burns or net dilution.</p><a href="/data/glance-daily.json" download>Download input snapshot</a><a href="/data/glance-methodology.json">Methods and source audit</a><a href="https://dune.com/queries/9077358" rel="noreferrer">Intents source</a><a href="https://dune.com/queries/9077345" rel="noreferrer">Price and network source</a><button className="glance-export" onClick={()=>{const blob=new Blob([JSON.stringify({analyticsVersion:ANALYTICS_VERSION,snapshotVersion:snapshot.version,asOf:snapshot.asOf,snapshot,analysis},null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download=`near-observed-${analysis.window.start}-${analysis.window.end}.json`;link.click();setTimeout(()=>URL.revokeObjectURL(url),0);}}>Export selected analysis</button></details><a className="glance-query" href={current.query} rel="noreferrer">View source on Dune</a></footer>
  </article>;
}

export function GlanceValidation(){return <details className="glance-validation"><summary>How the saved source comparison was checked</summary><p>These saved-window comparisons share upstream NEAR/DefiLlama lineage. Agreement tests extraction consistency, not independent transaction-level corroboration.</p><table><thead><tr><th scope="col">Measure</th><th scope="col">Source</th><th scope="col">Compared with</th><th scope="col">Difference</th></tr></thead><tbody>{economics.observed.checks.map(check=><tr key={check.metric}><th scope="row">{check.metric}<span>{check.window}</span></th><td>{check.primary}</td><td>{check.reference}</td><td>{Number(check.difference_pct)>0?'+':''}{Number(check.difference_pct).toFixed(2)}%</td></tr>)}</tbody></table></details>;}
