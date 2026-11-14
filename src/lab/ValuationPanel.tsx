import {useRef} from 'react';
import baseline from '../../data/lab-baseline.json' with {type:'json'};
import institutional from '../../data/institutional-demand.json' with {type:'json'};
import {runValuation,buildValuationCases,type ValuationInputs} from './valuation.ts';
import {CaseSlider} from './Transmission.tsx';
import {DitherCanvas,ditherArea,ditherBand,ditherField,ditherLine,ditherRect,text,rule,prefersReducedMotion,INK,GREEN,AMBER,BLUE} from './dither.tsx';
import {simulateBand,SIGMA_MONTHLY} from './uncertainty.ts';
import rigor from '../../data/lab-rigor.json' with {type:'json'};
import {formatPrice as price,formatUsdCompact} from '../format.ts';
const usd=(v:number|null)=>v===null||!Number.isFinite(v)?'Not reachable':formatUsdCompact(v);
const pct=(v:number)=>`${v.toFixed(1)}%`;
export const HOLDINGS_BASELINE_ID=`nrr:${institutional.nrr.holdingsIssuerDate}:${institutional.nrr.nearHeld}`;
export function heatColors(value:number){
 const t=Math.min(1,Math.max(0,value)),rgb=[244,248,244].map((v,i)=>Math.round(v+([23,59,48][i]-v)*t));
 let light=rgb.map(v=>Math.min(255,v+6));
 const luminance=(channels:number[])=>channels.map(v=>{const c=v/255;return c<=.04045?c/12.92:((c+.055)/1.055)**2.4;}).reduce((sum,v,i)=>sum+v*[.2126,.7152,.0722][i],0);
 let whiteContrast=1.05/(luminance(light)+.05);const darkContrast=(luminance(rgb)+.05)/.05;
 if(Math.max(whiteContrast,darkContrast)<4.5){light=[...rgb];whiteContrast=1.05/(luminance(light)+.05);}
 return {light:`rgb(${light.join(',')})`,dark:`rgb(${rgb.join(',')})`,ink:whiteContrast>darkContrast?'#ffffff':'#000000',contrast:Math.max(whiteContrast,darkContrast)};
}
export const STARTING={asOf:baseline.supply.blockUtc.slice(0,10),annualVolumeUsd:baseline.operating.windows[0].volumeUsd*365/30,annualReceiptsUsd:baseline.operating.windows[0].annualizedCapturedUsd,supplyNear:baseline.supply.supplyNear,spotPriceUsd:baseline.market.priceUsd,institutionalHoldingsNear:institutional.nrr.nearHeld,grossBps:baseline.operating.windows[0].grossBps,capturePct:baseline.operating.windows[0].cashCapturePct};
export const VAL_DEFAULTS={...buildValuationCases(STARTING).find(c=>c.id==='base')!.inputs};
export default function ValuationPanel({inputs,onChange,caseName}:{inputs:ValuationInputs,onChange:(a:ValuationInputs)=>void,caseName?:string}){
 const heatShown=useRef(new Map<string,number>()),holdingsShown=useRef(new Map<string,number>());
 const r=runValuation(inputs,STARTING),cases=buildValuationCases(STARTING,inputs.exitDate);
 const selected=cases.find(c=>(Object.keys(inputs) as (keyof ValuationInputs)[]).every(key=>c.inputs[key]===inputs[key]));
 const maximum=cases.find(c=>c.id==='maximum')!;
 const label=caseName||(selected?`${selected.label.split(' · ')[0]} Scenario`:'Custom Scenario');
 const draw=(pen:CanvasRenderingContext2D,w:number,h:number)=>{
  const left=50,bottom=h-30,top=18,max=Math.max(...r.rows.map(x=>x.totalUsd),1)*1.12,x=(i:number)=>left+i/(r.rows.length-1)*(w-left-12),y=(v:number)=>bottom-v/max*(bottom-top);
  [0,max/2,max].forEach(v=>{rule(pen,left,y(v),w,y(v));text(pen,usd(v),0,y(v)+4,{size:10});});
  ditherArea(pen,r.rows.map((v,i)=>[x(i),y(v.totalUsd)]),bottom,.35,AMBER);
  ditherArea(pen,r.rows.map((v,i)=>[x(i),y(v.intentsUsd+v.institutionalUsd)]),bottom,.6,BLUE);
  ditherArea(pen,r.rows.map((v,i)=>[x(i),y(v.intentsUsd)]),bottom,.85,GREEN);
  ditherLine(pen,r.rows.map((v,i)=>[x(i),y(v.totalUsd)]),INK,1.4);
  text(pen,STARTING.asOf,left,bottom+18,{size:10});text(pen,inputs.exitDate,w-10,bottom+18,{align:'right',size:10});
 };
 const band=simulateBand(inputs,STARTING);
 const fairMultiple=rigor.peers.stats.protocols.median,baselinePriceUsd=r.terminal.totalUsd*fairMultiple/r.terminal.supplyNear,wedgeUsd=r.terminal.revenuePriceUsd-baselinePriceUsd;
 const fan=(pen:CanvasRenderingContext2D,w:number,h:number)=>{
  const left=50,bottom=h-30,top=18;
  const lo=Math.max(1,Math.min(...band.rev.q10)*.7),hi=Math.max(...band.rev.q90)*1.15,logLo=Math.log(lo),logSpan=Math.log(hi)-logLo;
  const x=(i:number)=>left+i/Math.max(band.months,1)*(w-left-12),y=(v:number)=>bottom-(Math.log(Math.max(v,lo))-logLo)/logSpan*(bottom-top);
  [lo,Math.exp(logLo+logSpan/2),hi].forEach(v=>{rule(pen,left,y(v),w,y(v));text(pen,usd(v),0,y(v)+4,{size:10});});
  const points=(series:number[])=>series.map((v,i)=>[x(i),y(v)] as [number,number]);
  ditherBand(pen,points(band.rev.q90),points(band.rev.q10),.26,INK);
  pen.save();pen.setLineDash([5,4]);ditherLine(pen,points(band.rev.q50),'#20372d99',1);pen.restore();
  ditherLine(pen,r.rows.map((v,i)=>[x(i),y(v.totalUsd)]),GREEN,1.6);
  text(pen,'log scale',w-10,14,{align:'right',size:10});
  text(pen,STARTING.asOf,left,bottom+18,{size:10});text(pen,inputs.exitDate,w-10,bottom+18,{align:'right',size:10});
 };
 const growths=[...new Set([-1,4,6,8,inputs.growthPct])].sort((a,b)=>a-b),multiples=[...new Set([100,150,200,250,inputs.multiple])].sort((a,b)=>a-b);
 const cells=multiples.map(m=>growths.map(g=>runValuation({...inputs,growthPct:g,multiple:m},STARTING).terminal.futurePriceUsd));
 const holdingsShares=[...new Set([0,2,5,10,inputs.institutionalHoldingsPct])].sort((a,b)=>a-b),elasticities=[...new Set([.5,1,2,4,inputs.holdingsElasticity])].sort((a,b)=>a-b);
 const holdingsCells=elasticities.map(e=>holdingsShares.map(h=>runValuation({...inputs,institutionalHoldingsPct:h,holdingsElasticity:e},STARTING).terminal.futurePriceUsd));
 const drawHeat=(pen:CanvasRenderingContext2D,w:number,h:number,time:number,shown:Map<string,number>,growths:number[],multiples:number[],cells:number[][],holdings=false)=>{
  const still=prefersReducedMotion(),left=48,top=24,cw=(w-left)/growths.length,ch=(h-top-28)/multiples.length,min=Math.min(...cells.flat()),max=Math.max(...cells.flat());
  growths.forEach((g,i)=>text(pen,`${holdings?Number(g.toFixed(2)):g}%`,left+(i+.5)*cw,14,{align:'center',size:10}));
  multiples.forEach((m,j)=>{text(pen,holdings?`${m} η`:`${m}x`,0,top+(j+.5)*ch+4,{size:10});cells[j].forEach((v,i)=>{
   const x=left+i*cw,y=top+j*ch,target=max>min?(v-min)/(max-min):0,key=`${multiples.length}x${growths.length}:${j}:${i}`,previous=shown.get(key),t=still||previous===undefined?target:previous+(target-previous)*.16,colors=heatColors(t);shown.set(key,Math.abs(t-target)<.002?target:t);const gradient=pen.createLinearGradient(x,y,x+cw,y+ch);
   gradient.addColorStop(0,colors.light);gradient.addColorStop(1,colors.dark);pen.fillStyle=gradient;pen.fillRect(x,y,cw-3,ch-3);
   pen.save();pen.globalAlpha=.2;ditherField(pen,x+2,y+2,cw-7,ch-7,(px,py)=>.1+.32*(.5+.5*Math.sin(px*.032+py*.047-time*1.05))*(.6+.4*Math.sin(px*.011-py*.019+time*.6)),colors.ink);pen.restore();
   text(pen,v>=1000?usd(v):price(v),x+cw/2,y+ch/2+4,{align:'center',size:10,color:colors.ink});
   if(growths[i]===(holdings?inputs.institutionalHoldingsPct:inputs.growthPct)&&m===(holdings?inputs.holdingsElasticity:inputs.multiple)){pen.save();pen.strokeStyle=colors.ink;pen.lineWidth=1.5;pen.strokeRect(x+3,y+3,cw-9,ch-9);pen.restore();}
  });});
  text(pen,holdings?'Tracked ETF holdings share · conditional price':'Monthly existing Intents growth · future price',w,h-3,{align:'right',size:10});
 };
 const heat=(pen:CanvasRenderingContext2D,w:number,h:number,time:number)=>drawHeat(pen,w,h,time,heatShown.current,growths,multiples,cells);
 const holdingsHeat=(pen:CanvasRenderingContext2D,w:number,h:number,time:number)=>drawHeat(pen,w,h,time,holdingsShown.current,holdingsShares,elasticities,holdingsCells,true);
 const contributions=[{name:'Existing Intents',rev:r.terminal.intentsUsd,color:GREEN},{name:'Institutional routing',rev:r.terminal.institutionalUsd,color:BLUE},{name:'AI protocol-linked cash',rev:r.terminal.aiUsd,color:AMBER}].map(c=>({...c,value:c.rev*inputs.multiple/r.terminal.supplyNear}));
 const holdingsContribution={name:'ETF holdings adjustment',rev:0,color:INK,value:r.terminal.holdingsImpactUsd};
 const allContributions=[...contributions,holdingsContribution];
 const bridge=(pen:CanvasRenderingContext2D,w:number,h:number)=>{
  const left=4,right=w-8,total=Math.max(r.terminal.revenuePriceUsd+Math.max(0,r.terminal.holdingsImpactUsd),1);let x=left;
  allContributions.filter(c=>c.value>0).forEach(c=>{const width=c.value/total*(right-left);ditherRect(pen,x,25,width-2,58,.8,c.color);if(width>55)text(pen,price(c.value),x+width/2,16,{align:'center',size:12,color:c.color});x+=width;});
  if(holdingsContribution.value<0){const width=Math.min(right-left,Math.abs(holdingsContribution.value)/total*(right-left));ditherRect(pen,right-width,98,width,10,.5,INK);text(pen,`Holdings effect ${price(holdingsContribution.value)}`,left,108,{size:10,color:INK});}
  rule(pen,left,89,right,89);text(pen,`Conditional future price ${price(r.terminal.futurePriceUsd)}`,right,h-5,{align:'right',size:12,color:INK});
 };
 const rows:[string,(c:typeof cases[number])=>string][]=[
  ['REV-based token price',c=>price(c.result.terminal.revenuePriceUsd)],
  ['Tracked ETF holdings price effect',c=>price(c.result.terminal.holdingsImpactUsd)],
  ['Future token price',c=>price(c.result.terminal.futurePriceUsd)],
  ['Tracked ETF target holdings share',c=>pct(c.inputs.institutionalHoldingsPct)],
  ['Other-holder demand elasticity',c=>c.inputs.holdingsElasticity.toFixed(2)],
  ['Existing Intents volume · annual',c=>usd(c.result.terminal.volumeUsd)],
  ['Existing Intents growth · monthly',c=>pct(c.inputs.growthPct)],
  ['Starting gross fee · bps',c=>c.inputs.grossBps.toFixed(2)],
  ['Exit effective gross fee · bps',c=>c.result.terminal.effectiveGrossBps.toFixed(2)],
  ['Existing Intents cash capture',c=>pct(c.inputs.capturePct)],
  ['Compression elasticity',c=>c.inputs.compression.toFixed(2)],
  ['Intents / institutional cost haircut',c=>pct(c.inputs.costPct)],
  ['Existing Intents capturable REV',c=>usd(c.result.terminal.intentsUsd)],
  ['Incremental institutional volume · annual',c=>usd(c.inputs.institutionalVolumeAnnualUsd)],
  ['Institutional fee · bps',c=>c.inputs.institutionalFeeBps.toFixed(2)],
  ['Institutional cash capture',c=>pct(c.inputs.institutionalCapturePct)],
  ['Institutional capturable REV',c=>usd(c.result.terminal.institutionalUsd)],
  ['AI gross billing · annual',c=>usd(c.inputs.aiRevenueAnnualUsd)],
  ['AI cash margin',c=>pct(c.inputs.aiMarginPct)],
  ['AI cash routed to protocol',c=>pct(c.inputs.aiTokenLinkPct)],
  ['AI protocol-linked cash',c=>usd(c.result.terminal.aiUsd)],
  ['Total capturable REV · annualized',c=>usd(c.result.terminal.totalUsd)],
  ['Exit REV multiple',c=>`${c.inputs.multiple}x`],
  ['Projected total supply',c=>`${(c.result.terminal.supplyNear/1e9).toFixed(3)}bn NEAR`],
  ['Token capitalization at exit',c=>usd(c.result.terminal.futurePriceUsd*c.result.terminal.supplyNear)],
  ['Required annual return',c=>pct(c.inputs.discountPct)],
  ['Discounted reference today',c=>price(c.result.terminal.presentPriceUsd)]
 ];
 return <section className="lab-models lab-valuation" aria-labelledby="valuation-title">
  <header><h2 id="valuation-title">From revenue to token value.</h2></header>
  <details className="lab-reference lab-method"><summary>Compare reference cases</summary>
   <figure className="lab-card is-wide"><div className="lab-card-head"><h3>Operating assumptions to token value</h3><p>Reference cases at {inputs.exitDate}. Edits change the working model, not these benchmark columns. All cases use the common exit date selected above.</p></div>
    <div className="lab-frontier-table lab-case-table"><table><caption>Reference cases · annualized revenue and exit value</caption><thead><tr><th scope="col">Driver / output</th>{cases.map(c=><th key={c.id} scope="col">{c.label}</th>)}</tr></thead><tbody>{rows.map(([name,value])=><tr key={name} className={['Future token price','Total capturable REV · annualized','Discounted reference today'].includes(name)?'is-result':undefined}><th scope="row">{name}</th>{cases.map(c=><td key={c.id}>{value(c)}</td>)}</tr>)}</tbody></table></div>
    <figcaption>The reference holdings assumption preserves the tracked inventory. Selecting a case and then adjusting ETF holdings produces the separately labelled working result.</figcaption>
   </figure>
  </details>
  <div className="lab-grid">
   <figure className="lab-card is-wide lab-revenue-path"><div className="lab-card-head"><div className="lab-card-meta">{label}</div><h3>The capturable REV path</h3><p className="lab-card-headline"><strong>{usd(r.terminal.totalUsd)}</strong><span>annual protocol-capturable REV at exit. This chart measures revenue, before the valuation multiple, supply denominator and ETF holdings adjustment.</span></p></div>
    <div className="lab-card-chart"><DitherCanvas draw={draw} height={260} label="Projected annualized capturable REV: existing Intents, incremental institutional routing and AI protocol-linked cash."/><ul className="lab-legend"><li style={{color:GREEN}}>Existing Intents</li><li style={{color:BLUE}}>Institutional routing</li><li style={{color:AMBER}}>AI protocol cash</li></ul></div>
    <figcaption>Annualized REV at each monthly step. Institutional routing and AI billing ramp to their selected exit levels. ETF holdings do not enter this revenue series.</figcaption>
   </figure>
   <figure className="lab-card is-wide lab-uncertainty"><div className="lab-card-head"><div className="lab-card-meta">{label} · growth volatility</div><h3>The same case under historical volatility.</h3><p className="lab-card-headline"><strong>{price(band.terminal.q10)} – {price(band.terminal.q90)}</strong><span>10th–90th percentile conditional token value when monthly growth keeps the selected mean but moves with the observed volatility (σ = {(SIGMA_MONTHLY*100).toFixed(1)}% per month, {band.paths.toLocaleString('en-US')} seeded paths).</span></p></div>
    <div className="lab-card-chart"><DitherCanvas draw={fan} animate height={260} label="Ten-to-ninety percent band of annualized capturable REV under seeded growth volatility, with the deterministic case path."/><ul className="lab-legend"><li style={{color:GREEN}}>Deterministic case path</li><li style={{color:INK}}>10–90% growth band · median dashed</li></ul></div>
    <figcaption>Volatility is the only randomized input: fees, capture, institutional ramp, AI ramp, supply and the multiple stay at their selected values, and the identical seed makes every rerun reproduce these exact bands. The walk-forward check below shows historical bands under-covered in jump months, so read the fan as indicative width, not probability.</figcaption>
   </figure>
   <figure className="lab-card is-wide lab-price-bridge"><div className="lab-card-head"><div className="lab-card-meta">{label}</div><h3>Where the price comes from</h3><p>First capitalize revenue and divide by future total supply. Then inspect the separate ETF holdings adjustment.</p></div><div className="lab-card-chart"><DitherCanvas draw={bridge} height={150} label={`Future token value components: ${allContributions.map(c=>`${c.name} ${price(c.value)}`).join(', ')}; total ${price(r.terminal.futurePriceUsd)}.`}/></div><div className="lab-price-components">{allContributions.map(c=><div key={c.name}><span>{c.name}</span><strong style={{color:c.color}}>{price(c.value)}</strong><small>{c===holdingsContribution?'Conditional demand effect, not revenue':`${usd(c.rev)} annual capturable REV`}</small></div>)}</div>
    <div className="lab-holdings-inline"><h4>Adjust ETF holdings</h4><p className="lab-holdings-source">The tracked baseline is NRR’s {institutional.nrr.holdingsIssuerDate} inventory: {STARTING.institutionalHoldingsNear.toLocaleString('en-US',{maximumFractionDigits:0})} NEAR. The neutral setting preserves this token count.</p>
     <div className="lab-card-controls lab-holdings-controls"><CaseSlider name="institutionalHoldingsPct" inputs={inputs} onChange={onChange}/><CaseSlider name="holdingsElasticity" inputs={inputs} onChange={onChange}/></div>
     <p className="lab-holdings-source">Higher elasticity means a smaller price response. The target implies {r.terminal.institutionalHeldNear.toLocaleString('en-US',{maximumFractionDigits:0})} NEAR held at exit, a {new Intl.NumberFormat('en-US',{maximumFractionDigits:0,signDisplay:'always'}).format(r.terminal.institutionalHeldNear-STARTING.institutionalHoldingsNear)} NEAR inventory change.</p>
     <dl className="lab-holdings-results"><div><dt>REV-based token value</dt><dd>{price(r.terminal.revenuePriceUsd)}</dd></div><div><dt>ETF holdings adjustment</dt><dd>{r.terminal.holdingsImpactUsd>=0?'+':''}{price(r.terminal.holdingsImpactUsd)}</dd></div><div><dt>Conditional token value</dt><dd>{price(r.terminal.futurePriceUsd)}</dd></div><div><dt>Discounted reference today</dt><dd>{price(r.terminal.presentPriceUsd)}</dd></div></dl>
     <details className="lab-inline-method"><summary>Holdings assumptions and source</summary><p><a href="https://nrretf.com/">NRR issuer snapshot</a>, dated {institutional.nrr.holdingsIssuerDate}. This single-product inventory is not a census of institutional ownership; holdings and supply have different cutoffs. Target holdings and other-holder elasticity are scenario inputs. Custody does not burn tokens or create protocol revenue. The selected elasticity is not an estimated NEAR coefficient, and the REV multiple may already reflect capital demand; this is a counterfactual with the multiple held fixed.</p></details>
    </div><figcaption>The first three components sum to the REV anchor: annual capturable REV × multiple ÷ future total supply. The ETF holdings adjustment is separate; all four sum to the conditional token value. At the fee-capturing peer median of {fairMultiple}× trailing revenue, the same exit REV supports {price(baselinePriceUsd)}; the selected {Number(inputs.multiple)}× multiple contributes the remaining {price(wedgeUsd)} as a growth premium above today’s market pricing of comparable cash flows.</figcaption>
   </figure>
  </div>
  <section className="lab-sensitivities lab-method" aria-labelledby="lab-sensitivities-title"><h3 id="lab-sensitivities-title" className="lab-sensitivities-title">Valuation sensitivities</h3><div className="lab-grid">
   <figure className="lab-card"><div className="lab-card-head"><h3>Growth and the exit multiple</h3><p>Conditional price across existing Intents growth and REV multiples. Institutional routing, AI and ETF holdings assumptions stay fixed.</p></div><div className="lab-card-chart"><DitherCanvas draw={heat} animate height={300} label="Future token price sensitivity across the four cases’ growth rates and multiples, including the selected custom values."/></div><figcaption>Rows vary the exit multiple; columns vary existing Intents growth. The outlined cell is the working case.</figcaption><table className="tidal-sr"><caption>Future price sensitivity</caption><tbody>{multiples.map((m,j)=><tr key={m}><th>{m}x</th>{cells[j].map((v,i)=><td key={i}>{growths[i]}% growth: {price(v)}</td>)}</tr>)}</tbody></table></figure>
   <figure className="lab-card"><div className="lab-card-head"><h3>Holdings and market absorption</h3><p>Conditional price across ETF holdings shares and other-holder elasticity. Revenue, supply and the multiple stay fixed.</p></div><div className="lab-card-chart"><DitherCanvas draw={holdingsHeat} animate height={300} label="Conditional token price sensitivity across tracked ETF target holdings share and other-holder demand elasticity."/></div><figcaption>Columns vary the tracked share of future supply; rows vary elasticity. The outline marks the working assumptions. This is a demand adjustment, not extra revenue.</figcaption><table className="tidal-sr"><caption>Holdings and elasticity conditional price sensitivity</caption><tbody>{elasticities.map((e,j)=><tr key={e}><th>Elasticity {e}</th>{holdingsCells[j].map((v,i)=><td key={i}>{pct(holdingsShares[i])} holdings: {price(v)}</td>)}</tr>)}</tbody></table></figure>
  </div></section>
  <details className="lab-method"><summary>Observed baseline, equations and reproducibility</summary><dl>
   <dt>Operating cutoff</dt><dd>{baseline.operating.windows[0].start} to {baseline.operating.sourceCutoff}; <a href={baseline.market.url}>executed Dune source</a>. Volume {usd(baseline.operating.windows[0].volumeUsd)}, fees {usd(baseline.operating.windows[0].grossFeesUsd)}, receipts {usd(baseline.operating.windows[0].capturedUsd)}.</dd>
   <dt>Window sensitivity</dt><dd>30D annualized receipts {usd(baseline.operating.windows[0].annualizedCapturedUsd)}; 90D {usd(baseline.operating.windows[1].annualizedCapturedUsd)}. Neither is forecast revenue.</dd>
   <dt>Supply and price</dt><dd>RPC block {baseline.supply.blockHeight}, {baseline.supply.blockUtc}; {baseline.supply.issuancePct}% maximum annual issuance. Reference quote {price(baseline.market.priceUsd)} dated {baseline.market.sourceDate}; timestamps differ.</dd>
   <dt>Existing Intents</dt><dd>Annual volume × (1 + monthly growth)^(12 × ACT/365 years). Above baseline, fee rate × volume scale^−compression. Capturable REV = volume × fee × capture × (1 − costs).</dd>
   <dt>Institutional activity</dt><dd>Incremental annual volume × institutional fee × capture × (1 − costs). ETF subscriptions and product AUM are not protocol revenue.</dd>
   <dt>AI economics</dt><dd>AI gross billing × AI cash margin × proportion routed to the protocol. Gross billing is not added directly to capturable REV. The margin already absorbs AI operating costs. With the selected AI allocation set to zero, the future reference falls to {price(runValuation({...inputs,aiTokenLinkPct:0},STARTING).terminal.futurePriceUsd)}.</dd>
   <dt>Valuation</dt><dd>REV anchor = total capturable REV × multiple ÷ compounded total supply. Conditional price = REV anchor × [(future supply − starting tracked ETF tokens) / (future supply − target tracked ETF tokens)]^(1 / other-holder demand elasticity). Discounted value = conditional price ÷ (1 + required return)^ACT/365 years. Required return and multiple are assumptions, not a fitted WACC or a valuation floor.</dd>
   <dt>Tracked ETF holdings</dt><dd>Starting holdings are {STARTING.institutionalHoldingsNear.toLocaleString()} NEAR from NRR’s issuer snapshot dated {institutional.nrr.holdingsIssuerDate}. This is one tracked product, not a census of institutional ownership. Neutral case inputs preserve this token count at exit. Holdings alter conditional demand separately from fee-generating routing; no ETF assets or subscriptions enter REV.</dd>
   <dt>Maximum calibration</dt><dd>Maximum is a calibrated upside hypothesis, presented as $400 requirements rather than a separately estimated forecast. Its AI gross billing is solved to reach a $400 REV-based value with neutral holdings. {maximum.calibration?.status==='calibrated'?`At this horizon it requires ${usd(maximum.calibration.requiredAiRevenueAnnualUsd)} annual AI billing.`:'At this horizon the fixed drivers do not produce an exact $400 calibration.'} Custom inputs calculate their resulting price without a $400 cap.</dd>
   <dt>Unknowns</dt><dd>The source baseline does not identify future institutional attribution, AI profitability or a guaranteed AI-to-token allocation. Positive case values are assumptions. Maximum solves one input to the stated $400 hypothesis; it is not independent evidence of that value.</dd>
   <dt>Method reference</dt><dd><a href="https://arxiv.org/abs/2606.07445">Bubbles vs. Baselines (2026)</a> distinguishes institutional accumulation from transactional utility in an ETH/EIP-1559 equilibrium model. It is not calibrated to NEAR and provides no evidence for $400. Here, only incremental fee-generating services enter REV; ETF flows and holdings are not capitalized as revenue.</dd>
   <dt>Reproduction</dt><dd>npm test; node analysis/lab-baseline.mjs --check. Export JSON or share a version-bound link using the working-case controls above. All local calculations rerun; source ingestion is separate.</dd>
  </dl><p>These revenue-multiple scenarios do not establish a tokenholder cash-flow entitlement, fair-value floor or investment return. Token purchases remain discretionary.</p></details>
 </section>;
}
