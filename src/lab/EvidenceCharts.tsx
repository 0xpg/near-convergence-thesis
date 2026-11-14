import rigor from '../../data/lab-rigor.json' with {type:'json'};
import baseline from '../../data/lab-baseline.json' with {type:'json'};
import {DitherCanvas,ditherLine,ditherRect,text,rule,INK,MUTED,GREEN,RED,AMBER,BLUE,PAPER} from './dither.tsx';
import {formatUsdCompact as usd} from '../format.ts';

type Pen=CanvasRenderingContext2D;
const CASES=[{id:'bear',label:'Bear',growth:-1,color:RED},{id:'base',label:'Base',growth:4,color:GREEN},{id:'bull',label:'Bull',growth:6,color:BLUE},{id:'max',label:'Maximum',growth:8,color:AMBER}] as const;
const pct=(v:number,digits=1)=>`${v>0?'+':''}${v.toFixed(digits)}%`;
const monthLabel=(m:string)=>new Date(m+'-01T00:00:00Z').toLocaleString('en-US',{month:'short',timeZone:'UTC'});
const times=(v:number)=>`${v>=100?Math.round(v).toLocaleString('en-US'):v.toFixed(1)}×`;

const econ=rigor.econ,months=econ.months,mom=Object.entries(econ.growth.momGrowth);
const windows=(['3','6','9'] as const).map(k=>({key:k,...econ.cmgr[k]}));
const origins=econ.originSweep.fits;

function labelOn(pen:Pen,value:string,x:number,y:number,color:string,align:CanvasTextAlign='left'){
  pen.font='400 9px Saans, Arial, sans-serif';const width=pen.measureText(value).width,x0=align==='right'?x-width:x;
  pen.fillStyle=PAPER;pen.fillRect(x0-3,y-9,width+6,13);text(pen,value,x,y,{align,size:9,color});
}
function dot(pen:Pen,x:number,y:number,r:number,color:string){pen.fillStyle=color;pen.beginPath();pen.arc(x,y,r,0,Math.PI*2);pen.fill();}
function caseLines(pen:Pen,left:number,right:number,y:(v:number)=>number){
  for(const c of CASES)rule(pen,left,y(c.growth),right,y(c.growth),c.color+'aa',[4,4]);
}

function drawMoM(pen:Pen,w:number,h:number){
  const left=44,right=w-8,top=16,bottom=h-26,lo=-30,hi=60,y=(v:number)=>bottom-(v-lo)/(hi-lo)*(bottom-top);
  [-20,0,20,40,60].forEach(v=>{rule(pen,left,y(v),right,y(v),v===0?'#293b3255':undefined);text(pen,`${v}%`,0,y(v)+4,{size:10});});
  const slot=(right-left)/mom.length,bar=slot*.62;
  mom.forEach(([month,g],i)=>{
    const v=g*100,x=left+i*slot+(slot-bar)/2,y0=y(0),y1=y(v);
    ditherRect(pen,x,Math.min(y0,y1),bar,Math.abs(y1-y0),.85,v>=0?GREEN:RED);
    text(pen,monthLabel(month),x+bar/2,bottom+16,{align:'center',size:9});
    text(pen,`${Math.round(v)}`,x+bar/2,v>=0?y1-4:y1+11,{align:'center',size:9,color:INK});
  });
  caseLines(pen,left,right,y);
}

function drawIntervals(pen:Pen,w:number,h:number){
  const left=44,right=w-8,top=16,bottom=h-26,lo=-10,hi=50,y=(v:number)=>bottom-(Math.max(lo,Math.min(hi,v))-lo)/(hi-lo)*(bottom-top);
  [-10,0,10,20,30,40,50].forEach(v=>{rule(pen,left,y(v),right,y(v),v===0?'#293b3255':undefined);text(pen,`${v}%`,0,y(v)+4,{size:10});});
  const groups=windows.length+origins.length+1,slot=(right-left)/groups;
  windows.forEach((win,i)=>{
    const cx=left+(i+.5)*slot,[a,b]=win.ci90.map(v=>v*100);
    ditherRect(pen,cx-slot*.18,y(b),slot*.36,y(a)-y(b),.55,INK);
    dot(pen,cx,y(win.observedCmgr*100),4,INK);
    text(pen,`${win.key}m`,cx,bottom+16,{align:'center',size:9});
  });
  text(pen,'Bootstrap 90% interval',left+windows.length*slot/2,top+2,{align:'center',size:9,color:MUTED});
  const base=left+(windows.length+1)*slot;
  rule(pen,base-slot/2,top,base-slot/2,bottom,'#293b3222');
  const pts=origins.map((o,i)=>[base+(i+.5)*slot,y(o.impliedMonthlyGrowth*100)] as [number,number]);
  ditherLine(pen,pts,INK,1);
  pts.forEach(([x,yy],i)=>{dot(pen,x,yy,3,INK);text(pen,monthLabel(origins[i].startMonth),x,bottom+16,{align:'center',size:9});});
  text(pen,'Trend fit by start month',base+origins.length*slot/2,top+2,{align:'center',size:9,color:MUTED});
  caseLines(pen,left,right,y);
}

function drawFees(pen:Pen,w:number,h:number){
  const left=44,right=w-8,top=16,bottom=h-30;
  const vols=months.map(m=>m.avgDailyVolumeUsd),bps=months.map(m=>m.grossBps);
  const xLo=Math.log(Math.min(...vols)*.85),xHi=Math.log(Math.max(...vols)*1.15),yLo=8,yHi=24;
  const x=(v:number)=>left+(Math.log(v)-xLo)/(xHi-xLo)*(right-left),y=(v:number)=>bottom-(v-yLo)/(yHi-yLo)*(bottom-top);
  [10,15,20].forEach(v=>{rule(pen,left,y(v),right,y(v));text(pen,`${v} bps`,0,y(v)+4,{size:10});});
  [60e6,90e6,130e6].forEach(v=>{if(Math.log(v)>xLo&&Math.log(v)<xHi)text(pen,usd(v)+'/day',x(v),bottom+16,{align:'center',size:9});});
  const {slope,intercept}=econ.elasticity.monthly,fit=(v:number)=>Math.exp(intercept+slope*Math.log(v));
  const line:[number,number][]=[];for(let i=0;i<=24;i++){const v=Math.exp(xLo+(xHi-xLo)*i/24);line.push([x(v),y(fit(v))]);}
  ditherLine(pen,line,RED,1.4);
  months.forEach((m,i)=>{dot(pen,x(vols[i]),y(bps[i]),4.5,GREEN);text(pen,monthLabel(m.month),x(vols[i])+7,y(bps[i])+3,{size:9});});
  text(pen,`fitted ε̂ = ${slope.toFixed(2)} · HAC SE ${econ.elasticity.monthly.hacSe.toFixed(2)} · p = ${econ.elasticity.monthly.p.toFixed(2)}`,right,top+2,{align:'right',size:9,color:RED});
}

function drawCapture(pen:Pen,w:number,h:number){
  const left=44,right=w-8,top=16,bottom=h-26,hi=40,y=(v:number)=>bottom-v/hi*(bottom-top);
  [0,10,20,30,40].forEach(v=>{rule(pen,left,y(v),right,y(v));text(pen,`${v}%`,0,y(v)+4,{size:10});});
  const entries=Object.entries(econ.capture.monthlyCapturePct),slot=(right-left)/entries.length,bar=slot*.62;
  entries.forEach(([month,v],i)=>{
    const x0=left+i*slot+(slot-bar)/2;
    ditherRect(pen,x0,y(v),bar,y(0)-y(v),.8,month>='2026-03'?GREEN:MUTED);
    text(pen,monthLabel(month),x0+bar/2,bottom+16,{align:'center',size:9});
  });
  const switchX=left+entries.findIndex(([m])=>m==='2026-02')*slot+slot*(23/28);
  rule(pen,switchX,top,switchX,bottom,RED,[3,3]);text(pen,'Fee switch 23 Feb',switchX+4,top+8,{size:9,color:RED});
  const model=baseline.operating.windows[0].cashCapturePct;
  rule(pen,left,y(model),right,y(model),INK,[5,4]);labelOn(pen,`Model c₀ ${model.toFixed(1)}%`,left+4,y(model)-5,INK);
  const life=econ.capture.lifetimePooledPct;
  rule(pen,left,y(life),right,y(life),'#293b3288',[2,4]);labelOn(pen,`Year pooled ${life.toFixed(1)}%`,left+4,y(life)-5,MUTED);
}

function drawPeers(pen:Pen,w:number,h:number){
  const left=96,right=w-12,top=26,bottom=h-28,lo=Math.log10(2),hi=Math.log10(10000);
  const x=(v:number)=>left+(Math.log10(v)-lo)/(hi-lo)*(right-left);
  [1,10,100,1000,10000].forEach(v=>{if(v>=2){rule(pen,x(v),top,x(v),bottom);text(pen,times(v),x(v),bottom+16,{align:'center',size:9});}});
  ditherRect(pen,x(100),top,x(250)-x(100),bottom-top,.3,AMBER);
  text(pen,'Case multiples 100–250×',(x(100)+x(250))/2,top-8,{align:'center',size:9,color:AMBER});
  const rows=[{label:'Fee-capturing',items:rigor.peers.protocols,color:GREEN,yy:top+(bottom-top)*.32},{label:'Base-layer chains',items:rigor.peers.chains,color:BLUE,yy:top+(bottom-top)*.72}];
  for(const row of rows){
    text(pen,row.label,0,row.yy+4,{size:10});
    rule(pen,left,row.yy,right,row.yy,'#293b3218');
    row.items.forEach((p,i)=>{const px=x(p.multiple1y),jitter=(i%3-1)*6;dot(pen,px,row.yy+jitter,3.6,p.slug==='near'?'#20372d55':row.color);});
  }
  const med=rigor.peers.stats.protocols.median;
  rule(pen,x(med),rows[0].yy-16,x(med),rows[0].yy+16,INK);text(pen,`median ${times(med)}`,x(med),rows[0].yy-20,{align:'center',size:9,color:INK});
  const nx=x(rigor.peers.nearSpecific.multipleOnCapturedRevenue);
  dot(pen,nx,(rows[0].yy+rows[1].yy)/2,5.5,RED);
  text(pen,`NEAR today ≈${Math.round(rigor.peers.nearSpecific.multipleOnCapturedRevenue)}× captured receipts`,nx+9,(rows[0].yy+rows[1].yy)/2+4,{size:9,color:RED});
}

function drawRates(pen:Pen,w:number,h:number){
  const rowsData=rigor.rate.requiredReturnTable,left=170,right=w-12,top=22,bottom=h-26,lo=0,hi=50;
  const x=(v:number)=>left+(Math.min(hi,v)-lo)/(hi-lo)*(right-left),rowH=(bottom-top)/rowsData.length;
  ditherRect(pen,x(25),top,x(35)-x(25),bottom-top,.22,AMBER);text(pen,'Damodaran 25–35%',x(30),top-6,{align:'center',size:9,color:AMBER});
  ditherRect(pen,x(12),top,x(18)-x(12),bottom-top,.16,BLUE);text(pen,'CoinShares 12–18%',x(15),top-6,{align:'center',size:9,color:BLUE});
  [0,10,20,30,40,50].forEach(v=>{rule(pen,x(v),top,x(v),bottom);text(pen,`${v}%`,x(v),bottom+16,{align:'center',size:9});});
  rowsData.forEach((r,i)=>{
    const cy=top+(i+.5)*rowH,a=Math.min(r.rBlendBetaPct,r.rBtcBetaPct),b=Math.max(r.rBlendBetaPct,r.rBtcBetaPct);
    text(pen,r.label,0,cy+4,{size:10});
    ditherRect(pen,x(a),cy-5,Math.max(3,x(b)-x(a)),10,.9,INK);
    const label=`${a.toFixed(0)}–${b.toFixed(0)}%${b>hi?' →':''}`;
    if(x(b)+48<right)labelOn(pen,label,x(b)+6,cy+4,INK);else labelOn(pen,label,x(a)-6,cy+4,INK,'right');
  });
  rule(pen,x(26.3),top-2,x(26.3),bottom,RED);labelOn(pen,'Selected 26.3%',x(26.3)+4,bottom-4,RED);
}

const rolling=rigor.backtest.rollingOrigin;
function drawBacktest(pen:Pen,w:number,h:number){
  const left=46,right=w-10,top=22,bottom=h-28,points=rolling.threeMonth,list=points.map(f=>f.target);
  const error=points.map(f=>Math.log(f.realized/f.base)),bear=Math.log(points[0].bear/points[0].base),max=Math.log(points[0].max/points[0].base);
  const ticks=[-.5,0,1,3,9].map(v=>Math.log(1+v)),lo=Math.min(...error,bear,ticks[0])-.1,hi=Math.max(...error,max)+.15;
  const x=(i:number)=>left+i/(list.length-1)*(right-left),y=(v:number)=>bottom-(v-lo)/(hi-lo)*(bottom-top);
  const split=points.findIndex(f=>f.regime==='secondYear');
  ditherRect(pen,left,top,(x(split)+x(split-1))/2-left,bottom-top,.06,MUTED);
  labelOn(pen,'From launch-year origins',left+4,top+8,MUTED);labelOn(pen,'From second-year origins',(x(split)+x(split-1))/2+6,top+8,GREEN);
  ticks.forEach(v=>{if(v>lo&&v<hi){rule(pen,left,y(v),right,y(v),v===0?'#293b3266':undefined);text(pen,pct((Math.exp(v)-1)*100,0),0,y(v)+4,{size:10});}});
  ditherRect(pen,left,y(max),right-left,y(bear)-y(max),.35,GREEN);
  labelOn(pen,'Bear–Maximum range',right,y(max)-5,GREEN,'right');
  list.forEach((m,i)=>{if(i%3===0||i===list.length-1)text(pen,monthLabel(m)+' '+m.slice(2,4),x(i),bottom+16,{align:i===list.length-1?'right':'center',size:9});});
  ditherLine(pen,error.map((v,i)=>[x(i),y(v)]),'#293b3255',1);
  points.forEach((f,i)=>dot(pen,x(i),y(error[i]),3.2,f.regime==='launchYear'?MUTED:INK));
}

export function BacktestChart(){
  return <div className="lab-card-chart"><DitherCanvas draw={drawBacktest} height={280} label="How far realized Intents volume landed from the Base projection made three months earlier, for every month-end origin since launch, against the Bear-to-Maximum range."/><ul className="lab-legend"><li style={{color:INK}}>Realized vs Base, 3 months after each origin</li><li style={{color:GREEN}}>Range the four cases cover</li><li style={{color:MUTED}}>Launch-year origins</li></ul></div>;
}

export default function EvidenceCharts(){
  const growth=econ.growth;
  return <>
   <article className="lab-card is-wide"><div className="lab-card-head"><h3>Where the growth cases sit in the record.</h3><p>Ten month-over-month observations from the archived Dune series, then the trailing compound rates with seeded bootstrap intervals and the trend implied by every possible start month. The dashed lines are the four case rates.</p></div>
    <div className="lab-evidence-pair">
     <div><DitherCanvas draw={drawMoM} height={250} label="Monthly growth of average daily Intents volume with the four case growth rates marked."/><ul className="lab-legend">{CASES.map(c=><li key={c.id} style={{color:c.color}}>{c.label} {c.growth}% a month</li>)}</ul><p className="lab-evidence-caption">Median {pct(growth.median*100)}, mean {pct(growth.mean*100)}, standard deviation {(growth.sdMoM*100).toFixed(1)}%. The record is bimodal: flat or falling months, then +30% surges.</p></div>
     <div><DitherCanvas draw={drawIntervals} height={250} label="Trailing three, six and nine month compound growth with bootstrap intervals, and fitted trend growth by start month."/><ul className="lab-legend">{CASES.map(c=><li key={c.id} style={{color:c.color}}>{c.label} {c.growth}% a month</li>)}</ul><p className="lab-evidence-caption">{econ.originSweep.verdict} Base 4% sits near the middle of the 9-month interval but below the 6-month one.</p></div>
    </div>
   </article>
   <article className="lab-card is-wide"><div className="lab-card-head"><h3>Fees have not compressed; capture has risen.</h3><p>Monthly gross fee rate against volume, and the share of gross fees captured as receipts, from the same archived series.</p></div>
    <div className="lab-evidence-pair">
     <div><DitherCanvas draw={drawFees} height={250} label="Monthly gross fee basis points against average daily volume on a log scale, with the fitted elasticity line."/><p className="lab-evidence-caption">The fitted slope is statistically indistinguishable from zero (n = {econ.elasticity.monthly.n}). Any compression in Bull and Maximum is an assumption the record neither confirms nor rejects.</p></div>
     <div><DitherCanvas draw={drawCapture} height={250} label="Monthly capture share of gross fees, with the fee switch date and the model starting capture marked."/><p className="lab-evidence-caption">Capture was already rising before the switch (Welch p = {econ.capture.welch.p.toFixed(2)}), so the step cannot be cleanly attributed to it. The model’s 30.5% matches recent months, above the year’s pooled {econ.capture.lifetimePooledPct.toFixed(1)}%.</p></div>
    </div>
   </article>
   <article className="lab-card is-wide"><div className="lab-card-head"><h3>The multiple and the hurdle against outside evidence.</h3><p>Market capitalization over trailing-year DefiLlama revenue for {rigor.peers.protocols.length+rigor.peers.chains.length} assets on {rigor.peers.retrievedAt}, and the required return implied by NEAR’s beta under each published or realized crypto market premium.</p></div>
    <div className="lab-evidence-pair">
     <div><DitherCanvas draw={drawPeers} height={250} label="Peer market-capitalization-to-revenue multiples on a log scale, with the case multiple range and NEAR's current multiple on captured receipts."/><p className="lab-evidence-caption">Every case multiple falls in the empty gap between fee-capturing protocols and base layers. On captured Intents receipts NEAR already trades near the Base 200×; on DefiLlama’s burn-only revenue it would read {times(rigor.peers.nearSpecific.burnDefinitionMultiple1y)}.</p></div>
     <div><DitherCanvas draw={drawRates} height={250} label="Required annual return ranges implied by NEAR's beta under five market premium variants, against the selected 26.3% hurdle."/><p className="lab-evidence-caption">Bars span NEAR’s beta of {rigor.rate.beta.blendWeekly.beta.toFixed(2)} (BTC+ETH) to {rigor.rate.beta.btcWeekly.beta.toFixed(2)} (BTC) over {rigor.rate.beta.btcWeekly.n} post-ETF weeks, with the {rigor.rate.riskFree.pct.toFixed(2)}% five-year Treasury as the risk-free rate. The spread between variants is the finding.</p></div>
    </div>
    <table className="tidal-sr"><caption>Peer multiples</caption><tbody>{[...rigor.peers.protocols,...rigor.peers.chains].map(p=><tr key={p.slug}><th>{p.name}</th><td>{times(p.multiple1y)}</td></tr>)}</tbody></table>
   </article>
  </>;
}
