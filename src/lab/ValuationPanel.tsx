import {baseline} from './engine.ts';
import {runValuation,buildValuationCases,exitDateBounds,VALUATION_LIMITS,type ValuationInputs} from './valuation.ts';
import {DitherCanvas,ditherArea,ditherLine,ditherRect,text,rule,INK,GREEN,AMBER,BLUE} from './dither.tsx';
const usd=(v:number|null)=>v===null||!Number.isFinite(v)?'Not reachable':new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',notation:'compact',maximumFractionDigits:1}).format(v);
const price=(v:number)=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:2}).format(v);
const pct=(v:number)=>`${v.toFixed(1)}%`;
const names={growthPct:'Monthly existing Intents growth',capturePct:'Existing Intents receipt / fee ratio',grossBps:'Existing Intents gross fee · bps',compression:'Existing Intents fee compression',costPct:'Intents and institutional cost haircut',multiple:'Exit capturable REV multiple',discountPct:'Required annual return',issuancePct:'Annual gross issuance',institutionalVolumeAnnualUsd:'Incremental institutional volume · annual',institutionalFeeBps:'Institutional fee · bps',institutionalCapturePct:'Institutional receipt / fee ratio',aiRevenueAnnualUsd:'AI gross billing · annual',aiMarginPct:'AI cash margin',aiTokenLinkPct:'AI cash routed to protocol'};
export const STARTING={asOf:baseline.supply.blockUtc.slice(0,10),annualVolumeUsd:baseline.operating.windows[0].volumeUsd*365/30,annualReceiptsUsd:baseline.operating.windows[0].annualizedCapturedUsd,supplyNear:baseline.supply.supplyNear,spotPriceUsd:baseline.market.priceUsd,grossBps:baseline.operating.windows[0].grossBps,capturePct:baseline.operating.windows[0].cashCapturePct};
export const VAL_DEFAULTS={...buildValuationCases(STARTING).find(c=>c.id==='base')!.inputs};
export default function ValuationPanel({inputs,onChange}:{inputs:ValuationInputs,onChange:(a:ValuationInputs)=>void}){
 const bounds=exitDateBounds(STARTING.asOf),r=runValuation(inputs,STARTING),cases=buildValuationCases(STARTING,inputs.exitDate),set=(patch:Partial<ValuationInputs>)=>onChange({...inputs,...patch});
 const selected=cases.find(c=>(Object.keys(inputs) as (keyof ValuationInputs)[]).every(key=>c.inputs[key]===inputs[key]));
 const maximum=cases.find(c=>c.id==='maximum')!;
 const draw=(pen:CanvasRenderingContext2D,w:number,h:number)=>{
  const left=50,bottom=h-30,top=18,max=Math.max(...r.rows.map(x=>x.totalUsd),1)*1.12,x=(i:number)=>left+i/(r.rows.length-1)*(w-left-12),y=(v:number)=>bottom-v/max*(bottom-top);
  [0,max/2,max].forEach(v=>{rule(pen,left,y(v),w,y(v));text(pen,usd(v),0,y(v)+4,{size:10});});
  ditherArea(pen,r.rows.map((v,i)=>[x(i),y(v.totalUsd)]),bottom,.35,AMBER);
  ditherArea(pen,r.rows.map((v,i)=>[x(i),y(v.intentsUsd+v.institutionalUsd)]),bottom,.6,BLUE);
  ditherArea(pen,r.rows.map((v,i)=>[x(i),y(v.intentsUsd)]),bottom,.85,GREEN);
  ditherLine(pen,r.rows.map((v,i)=>[x(i),y(v.totalUsd)]),INK,1.4);
  text(pen,STARTING.asOf,left,bottom+18,{size:10});text(pen,inputs.exitDate,w-10,bottom+18,{align:'right',size:10});
 };
 const growths=[0,2,4,8,12],multiples=[100,150,200,300,500];
 const cells=multiples.map(m=>growths.map(g=>runValuation({...inputs,growthPct:g,multiple:m},STARTING).terminal.futurePriceUsd));
 const heat=(pen:CanvasRenderingContext2D,w:number,h:number)=>{
  const left=48,top=24,cw=(w-left)/5,ch=(h-top-28)/5,max=Math.max(...cells.flat(),1);
  growths.forEach((g,i)=>text(pen,`${g}%`,left+(i+.5)*cw,14,{align:'center',size:10}));
  multiples.forEach((m,j)=>{text(pen,`${m}x`,0,top+(j+.5)*ch+4,{size:10});cells[j].forEach((v,i)=>{const x=left+i*cw,y=top+j*ch;pen.fillStyle='#f2f5ef';pen.fillRect(x,y,cw-3,ch-3);ditherRect(pen,x,y,cw-3,ch-3,.06+.45*v/max,GREEN);text(pen,price(v),x+cw/2,y+ch/2+4,{align:'center',size:10,color:INK});});});
  text(pen,'Monthly existing Intents growth · future price',w,h-3,{align:'right',size:10});
 };
 const contributions=[{name:'Existing Intents',rev:r.terminal.intentsUsd,color:GREEN},{name:'Incremental institutions',rev:r.terminal.institutionalUsd,color:BLUE},{name:'AI protocol-linked cash',rev:r.terminal.aiUsd,color:AMBER}].map(c=>({...c,value:c.rev*inputs.multiple/r.terminal.supplyNear}));
 const bridge=(pen:CanvasRenderingContext2D,w:number,h:number)=>{
  const left=4,right=w-8,total=Math.max(r.terminal.futurePriceUsd,1);let x=left;
  contributions.forEach(c=>{const width=c.value/total*(right-left);ditherRect(pen,x,25,width-2,58,.8,c.color);if(width>55)text(pen,price(c.value),x+width/2,16,{align:'center',size:12,color:c.color});x+=width;});
  rule(pen,left,89,right,89);text(pen,`Total future price ${price(r.terminal.futurePriceUsd)}`,right,h-5,{align:'right',size:12,color:INK});
 };
 const rows:[string,(c:typeof cases[number])=>string][]=[
  ['Future token price',c=>price(c.result.terminal.futurePriceUsd)],
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
  <header><h2 id="valuation-title">Four paths to value.</h2><p>Bear, Base, Bull and a calibrated $400 Maximum case. Every case uses the same exit date and separates existing activity from incremental institutional and AI economics.</p></header>
  <div className="lab-console-controls">
   <div className="lab-presets" role="group" aria-label="Valuation cases">{cases.map(c=><button key={c.id} type="button" aria-pressed={selected?.id===c.id} onClick={()=>onChange({...c.inputs})}>{c.label}</button>)}</div>
   <details className="lab-case-controls"><summary>Edit {selected?.label||'custom'} assumptions</summary><div className="lab-console-sliders">
    <label className="lab-slider"><span className="lab-slider-head">Common exit date</span><input type="date" aria-label="Valuation exit date" min={bounds.min} max={bounds.max} value={inputs.exitDate} onChange={e=>{const d=e.target.value;if(d>=bounds.min&&d<=bounds.max)set({exitDate:d});}}/></label>
    {(Object.keys(VALUATION_LIMITS) as (keyof typeof VALUATION_LIMITS)[]).map(key=>{const [min,max,step]=VALUATION_LIMITS[key];return <label key={key} className="lab-slider"><span className="lab-slider-head"><span>{names[key]}</span><output>{key.endsWith('Usd')?usd(inputs[key]):key==='multiple'?`${inputs[key]}x`:key.endsWith('Pct')?pct(inputs[key]):key.endsWith('Bps')?`${inputs[key].toFixed(2)} bps`:inputs[key].toFixed(2)}</output></span><input type="range" aria-label={names[key]} min={min} max={max} step={step} value={inputs[key]} onChange={e=>set({[key]:Number(e.target.value)})}/></label>;})}
   </div></details>
  </div>
  <div className="lab-grid">
   <figure className="lab-card is-wide"><div className="lab-card-head"><div className="lab-card-meta">Common exit · {inputs.exitDate}</div><h3>Operating assumptions to token value</h3><p>REV here means modeled cash potentially captured by the protocol after the specified haircuts. It is not gross customer billing, net income or a guaranteed tokenholder distribution.</p></div>
    <div className="lab-frontier-table lab-case-table"><table><caption>Four preset cases · common exit · no probability weighting</caption><thead><tr><th scope="col">Driver / output</th>{cases.map(c=><th key={c.id} scope="col">{c.label}</th>)}</tr></thead><tbody>{rows.map(([label,value],i)=><tr key={label} className={['Future token price','Total capturable REV · annualized','Discounted reference today'].includes(label)?'is-result':undefined}><th scope="row">{label}</th>{cases.map(c=><td key={c.id}>{value(c)}</td>)}</tr>)}</tbody></table></div>
    <figcaption><strong>Maximum is a calibrated upside hypothesis.</strong> AI gross billing is solved to reach $400 at exit after fixing the other assumptions. It is not an independently estimated ceiling; editing the assumptions can produce a higher or lower price. {maximum.calibration?.status==='calibrated'?`The calibration requires ${usd(maximum.calibration.requiredAiRevenueAnnualUsd)} in annual AI gross billing. `:'The selected horizon may make the $400 calibration infeasible under the other fixed drivers. '}The Bear, Base and Bull cases are explicit scenarios, not estimated probabilities. Custom edits change the selected-case charts below; these columns remain the four reference presets at the chosen date.</figcaption>
   </figure>
   <figure className="lab-card"><div className="lab-card-head"><div className="lab-card-meta">{selected?.label||'Custom case'} · {r.years.toFixed(2)} years</div><h3>The capturable REV path</h3><p className="lab-card-headline"><strong>{price(r.terminal.futurePriceUsd)}</strong><span>Future token reference at exit; {price(r.terminal.presentPriceUsd)} discounted to {STARTING.asOf}. All components use the same capturable REV multiple.</span></p></div>
    <div className="lab-card-chart"><DitherCanvas draw={draw} height={260} label="Projected annualized capturable REV: existing Intents, incremental institutional activity and AI protocol-linked cash."/><ul className="lab-legend"><li style={{color:GREEN}}>Existing Intents</li><li style={{color:BLUE}}>Institutions</li><li style={{color:AMBER}}>AI</li></ul></div>
    <figcaption>Monthly observations of an annualized run rate, not monthly cash receipts. Terminal REV {usd(r.terminal.totalUsd)} × {inputs.multiple}x ÷ {(r.terminal.supplyNear/1e9).toFixed(3)}bn tokens. Institutional activity and AI billing ramp to the exit assumptions. No buyback, gas burn or staking return is credited.</figcaption>
   </figure>
   <figure className="lab-card"><div className="lab-card-head"><div className="lab-card-meta">Two-way sensitivity</div><h3>Growth and the exit multiple</h3><p>Future price across existing Intents growth and capturable REV multiples. Institutional and AI assumptions remain fixed in this grid.</p></div><div className="lab-card-chart"><DitherCanvas draw={heat} height={300} label="Future token price sensitivity: rows exit multiples 100 to 500, columns monthly existing Intents volume growth zero to twelve percent."/></div><figcaption>Each cell reruns the selected case at the same date, capture, compression, dilution and incremental activity assumptions. Neither $400 nor a scenario label caps the calculation.</figcaption><table className="tidal-sr"><caption>Future price sensitivity</caption><tbody>{multiples.map((m,j)=><tr key={m}><th>{m}x</th>{cells[j].map((v,i)=><td key={i}>{growths[i]}% growth: {price(v)}</td>)}</tr>)}</tbody></table></figure>
   <figure className="lab-card is-wide"><div className="lab-card-head"><div className="lab-card-meta">Value bridge · {selected?.label||'Custom case'}</div><h3>Where the price comes from</h3></div><div className="lab-card-chart"><DitherCanvas draw={bridge} height={125} label={`Future token value components: ${contributions.map(c=>`${c.name} ${price(c.value)}`).join(', ')}; total ${price(r.terminal.futurePriceUsd)}.`}/></div><div className="lab-price-components">{contributions.map(c=><div key={c.name}><span>{c.name}</span><strong style={{color:c.color}}>{price(c.value)}</strong><small>{usd(c.rev)} annual capturable REV</small></div>)}</div><figcaption>Each component contributes annual capturable REV × the same exit multiple ÷ future total supply. These components add to the future price; discounted value applies the required return once to their sum. Institutional volume must be incremental to existing Intents, and AI billing must exclude settlement fees already counted elsewhere.</figcaption></figure>
  </div>
  <details className="lab-method"><summary>Observed baseline, equations and reproducibility</summary><dl>
   <dt>Operating cutoff</dt><dd>{baseline.operating.windows[0].start} to {baseline.operating.sourceCutoff}; <a href={baseline.market.url}>executed Dune source</a>. Volume {usd(baseline.operating.windows[0].volumeUsd)}, fees {usd(baseline.operating.windows[0].grossFeesUsd)}, receipts {usd(baseline.operating.windows[0].capturedUsd)}.</dd>
   <dt>Window sensitivity</dt><dd>30D annualized receipts {usd(baseline.operating.windows[0].annualizedCapturedUsd)}; 90D {usd(baseline.operating.windows[1].annualizedCapturedUsd)}. Neither is forecast revenue.</dd>
   <dt>Supply and price</dt><dd>RPC block {baseline.supply.blockHeight}, {baseline.supply.blockUtc}; {baseline.supply.issuancePct}% maximum annual issuance. Reference quote {price(baseline.market.priceUsd)} dated {baseline.market.sourceDate}; timestamps differ.</dd>
   <dt>Existing Intents</dt><dd>Annual volume × (1 + monthly growth)^(12 × ACT/365 years). Above baseline, fee rate × volume scale^−compression. Capturable REV = volume × fee × capture × (1 − costs).</dd>
   <dt>Institutional activity</dt><dd>Incremental annual volume × institutional fee × capture × (1 − costs). ETF subscriptions and product AUM are not protocol revenue.</dd>
   <dt>AI economics</dt><dd>AI gross billing × AI cash margin × proportion routed to the protocol. Gross billing is not added directly to capturable REV. The margin already absorbs AI operating costs. With the selected AI allocation set to zero, the future reference falls to {price(runValuation({...inputs,aiTokenLinkPct:0},STARTING).terminal.futurePriceUsd)}.</dd>
   <dt>Valuation</dt><dd>Future token value = total capturable REV × multiple ÷ compounded total supply. Discounted value = future value ÷ (1 + required return)^ACT/365 years. Required return and multiple are assumptions, not a fitted WACC or a valuation floor.</dd>
   <dt>Unknowns</dt><dd>The source baseline does not identify future institutional attribution, AI profitability or a guaranteed AI-to-token allocation. Positive case values are assumptions. Maximum solves one input to the stated $400 hypothesis; it is not independent evidence of that value.</dd>
   <dt>Method reference</dt><dd><a href="https://arxiv.org/abs/2606.07445">Bubbles vs. Baselines (2026)</a> distinguishes institutional accumulation from transactional utility in an ETH/EIP-1559 equilibrium model. It is not calibrated to NEAR and provides no evidence for $400. Here, only incremental fee-generating services enter REV; ETF flows and holdings are not capitalized as revenue.</dd>
   <dt>Reproduction</dt><dd>npm test; node analysis/lab-baseline.mjs --check. Export JSON or share a version-bound link using the controls below. All local calculations rerun; source ingestion is separate.</dd>
  </dl><p>These revenue-multiple scenarios do not establish a tokenholder cash-flow entitlement, fair-value floor or investment return. Token purchases remain discretionary.</p></details>
 </section>;
}
