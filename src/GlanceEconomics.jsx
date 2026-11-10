import React,{useState} from 'react';
import economics from '../data/glance-economics.json';
import {DitherCanvas,ditherRect,ditherLine,text,rule,INK,MUTED,GREEN,SOFT,RED,AMBER} from './lab/dither.jsx';

const data=economics.observed;
const n=value=>Number(value);
const usd=(value,digits=1)=>{const v=n(value);if(Math.abs(v)>=1e9)return '$'+(v/1e9).toFixed(2)+'bn';if(Math.abs(v)>=1e6)return '$'+(v/1e6).toFixed(digits)+'m';if(Math.abs(v)>=1e3)return '$'+Math.round(v).toLocaleString('en-US');return '$'+v.toFixed(0);};
const pct=(value,digits=1)=>n(value).toFixed(digits)+'%';
const dateLabel=value=>new Date(value+'T00:00:00Z').toLocaleDateString('en-GB',{day:'numeric',month:'short',timeZone:'UTC'});
const windowLabel=`${dateLabel(data.window.start)} – ${dateLabel(data.window.end)} ${data.window.end.slice(0,4)}`;
const queries={scorecard:'https://dune.com/queries/9103907',waterfall:'https://dune.com/queries/9103908',monthly:'https://dune.com/queries/9103909'};

export function GlanceScorecard(){
  const s=data.scorecard;
  const stats=[
    {label:'Intents volume',value:usd(s.volume_usd),note:`${Math.round(n(s.swaps)/1000).toLocaleString('en-US')}k swaps · ${usd(s.avg_swap_usd)} average`},
    {label:'Kept per $1m traded',value:usd(s.retained_per_1m_usd),note:`${n(s.retained_bps).toFixed(1)} bps of ${n(s.gross_bps).toFixed(1)} bps charged`},
    {label:'Share of fees kept',value:pct(s.retained_share_pct),note:`${usd(s.retained_usd)} of ${usd(s.gross_fees_usd)} in fees`},
    {label:'Revenue against issuance',value:pct(s.revenue_pct_issuance),note:'All protocol revenue as a share of new NEAR issued'},
    {label:'Daily transactions',value:Math.round(n(s.avg_daily_transactions)/1000).toLocaleString('en-US')+'k',note:'Average across the window on the NEAR base chain'}
  ];
  return <section className="glance-scorecard" aria-labelledby="glance-scorecard-title">
    <div className="glance-scorecard-head"><h3 id="glance-scorecard-title">The last 30 days</h3><p>{windowLabel} · completed UTC days</p></div>
    <dl className="glance-scorecard-grid">{stats.map(stat=><div key={stat.label}><dt>{stat.label}</dt><dd><strong>{stat.value}</strong><span>{stat.note}</span></dd></div>)}</dl>
    <p className="glance-scorecard-foot">Dune, reconciled with the DefiLlama API to within 0.02%. <a href={queries.scorecard} rel="noreferrer">View query on Dune</a></p>
  </section>;
}

function drawWaterfall(pen,width,height){
  const rows=data.waterfall.map(step=>({label:step.step,value:n(step.usd_per_1m)}));
  const gross=rows[0].value,left=Math.min(150,width*.3),right=width-72,scale=x=>left+x/gross*(right-left);
  const tones=[SOFT,RED,GREEN],band=(height-56)/rows.length;
  let running=0;
  rows.forEach((row,index)=>{
    const top=24+index*band,bar=Math.min(38,band*.55),y=top+(band-bar)/2;
    const from=index===2?0:(row.value<0?running+row.value:running),to=index===2?row.value:(row.value<0?running:running+row.value);
    ditherRect(pen,scale(from),y,scale(to)-scale(from),bar,index===1?.55:.8,tones[index]);
    text(pen,row.label,0,y+bar/2,{size:12,color:INK,baseline:'middle'});
    text(pen,(row.value<0?'−':'')+'$'+Math.abs(Math.round(row.value)).toLocaleString('en-US'),index===1?scale(from)-8:scale(to)+8,y+bar/2,{size:13,color:INK,weight:500,baseline:'middle',align:index===1?'right':'left'});
    if(index===0)running=row.value;else if(index===1)running+=row.value;
  });
  rule(pen,left,height-26,right,height-26);
  text(pen,'USD per $1m of reported Intents volume',left,height-8,{size:11,color:MUTED});
}

function drawMonthly(pen,width,height){
  const months=data.monthly.filter(m=>!m.partial),left=36,right=width-40,top=20,bottom=height-36;
  const maxBps=Math.ceil(Math.max(...months.map(m=>m.gross_bps))/5)*5,y=v=>bottom-v/maxBps*(bottom-top);
  const step=(right-left)/months.length,bar=Math.max(6,step*.56);
  for(let v=0;v<=maxBps;v+=5){rule(pen,left,y(v),right,y(v),'#293b3214');text(pen,v+' bps',left-6,y(v)+4,{size:10,color:MUTED,align:'right'});}
  months.forEach((m,i)=>{const x=left+i*step+(step-bar)/2;ditherRect(pen,x,y(m.retained_bps),bar,bottom-y(m.retained_bps),.85,GREEN);if(i%2===0||i===months.length-1)text(pen,m.month.slice(2).replace('-','/'),x+bar/2,bottom+16,{size:10,color:MUTED,align:'center'});});
  ditherLine(pen,months.map((m,i)=>[left+i*step+step/2,y(m.gross_bps)]),AMBER,1.5);
  const last=months.at(-1);
  text(pen,'Charged',left+(months.length-1)*step+step/2+6,y(last.gross_bps)-6,{size:11,color:AMBER,weight:500});
  text(pen,'Kept',left+(months.length-1)*step+step/2+6,y(last.retained_bps)+4,{size:11,color:GREEN,weight:500});
}

export function GlanceRetention({available=true}){
  const [view,setView]=useState('waterfall');
  const {first,last}=data.trend;
  const views={waterfall:{tab:'Per $1m',draw:drawWaterfall,label:'Waterfall of Intents fees per $1m of volume: gross fees, amount paid out and amount retained by the protocol.',query:queries.waterfall},
    monthly:{tab:'Monthly',draw:drawMonthly,label:'Monthly Intents fees charged and kept, in basis points of volume.',query:queries.monthly}};
  const current=views[view];
  return <article className="glance-tile glance-retention" aria-labelledby="glance-retention-title">
    <div className="glance-tile-head"><span className="glance-category">Economics</span><h4 id="glance-retention-title">What NEAR keeps</h4>
      <div className="glance-switch" role="group" aria-label="Fee retention views">{Object.entries(views).map(([key,option])=><button key={key} aria-pressed={view===key} aria-controls="glance-retention-chart" onClick={()=>setView(key)}>{option.tab}</button>)}</div>
      {available?<div className="glance-insight" aria-live="polite"><strong>{pct(data.scorecard.retained_share_pct)}</strong><p className="glance-observation">{view==='waterfall'?'Of every Intents fee, this share stays with the protocol; the rest is paid to distribution channels, solvers and other recipients.':`Kept fees rose from ${first.retained_bps} to ${last.retained_bps} bps of volume between ${first.month} and ${last.month}, while the rate charged fell from ${first.gross_bps} to ${last.gross_bps} bps.`}</p></div>:<p role="status">Snapshot insight unavailable. The chart and source query remain available.</p>}
    </div>
    <div className="glance-chart glance-native" id="glance-retention-chart"><DitherCanvas key={view} draw={current.draw} height="100%" label={current.label}/></div>
    {available&&<blockquote className="glance-takeaway">Charging less while keeping more is the pattern the token case needs. It still rests on a few distribution channels: if they win a larger share, retention can fall even as volume grows.</blockquote>}
    <footer className="glance-footer"><details><summary>Evidence & calculation</summary><p>{windowLabel}. Gross fees and protocol revenue come from DefiLlama’s NEAR revenue feed in NEAR, converted at each day’s price; volume is reported settlement notional.</p><p>Paid out = gross fees − protocol revenue. It combines distribution channels, solvers and other recipients, which the source does not separate. The current month is partial and excluded from the monthly chart.</p><a href="data/glance-economics.json" download>Download calculations</a></details><a className="glance-query" href={current.query} rel="noreferrer">View query on Dune</a></footer>
  </article>;
}

export function GlanceInstitutional({available=true}){
  const {pending,unavailable}=data.institutional;
  return <article className="glance-tile glance-institutional" aria-labelledby="glance-institutional-title">
    <div className="glance-tile-head"><span className="glance-category">Institutions and agents</span><h4 id="glance-institutional-title">Institutional and agent demand</h4>
      {available?<div className="glance-insight"><p className="glance-observation">Counted only from sources that can attribute it. Holdings come from issuer and company disclosures; order flow needs a source that identifies who placed it.</p></div>:<p role="status">Snapshot insight unavailable. The chart and source query remain available.</p>}
    </div>
    <div className="glance-unavailable"><ul>{pending.map(item=><li key={item}><span>{item}</span><em className="is-pending">Source in progress</em></li>)}{unavailable.map(item=><li key={item}><span>{item}</span><em>Unavailable</em></li>)}</ul></div>
    {available&&<blockquote className="glance-takeaway">Institutional and agent demand are central to the thesis, but neither is yet observable in Intents data. Integrations and partnerships are not counted as volume.</blockquote>}
    <footer className="glance-footer"><details><summary>Evidence & calculation</summary><p>Holdings will be cited from the issuers’ own product disclosures and the companies’ filings, each with its date. Until then they are marked as in progress rather than estimated.</p><p>Order flow is counted only when a verifiable source attributes it to an institution or an agent. Integrations, partnerships and trade size are not treated as proof of either.</p><a href="data/glance-economics.json" download>Download calculations</a></details></footer>
  </article>;
}

export function GlanceValidation(){
  return <details className="glance-validation"><summary>How these numbers were checked</summary>
    <table><thead><tr><th scope="col">Measure</th><th scope="col">Source</th><th scope="col">Checked against</th><th scope="col">Difference</th></tr></thead>
      <tbody>{data.checks.map(check=><tr key={check.metric}><th scope="row">{check.metric}<span>{check.window}</span></th><td>{check.primary}</td><td>{check.reference}</td><td>{n(check.difference_pct)>0?'+':''}{n(check.difference_pct).toFixed(2)}%{check.note&&<span>{check.note}</span>}</td></tr>)}</tbody></table>
  </details>;
}
