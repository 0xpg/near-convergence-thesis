import {useEffect,useLayoutEffect,useMemo,useRef,useState} from 'react';
import baseline from '../../data/lab-baseline.json' with {type:'json'};
import institutional from '../../data/institutional-demand.json' with {type:'json'};
import ValuationPanel,{STARTING,VAL_DEFAULTS,HOLDINGS_BASELINE_ID} from './ValuationPanel.tsx';
import {MODEL_VERSION,VALUATION_PRESETS,cleanValuation,runValuation,buildValuationCases,exitDateBounds,type ValuationInputs} from './valuation.ts';
import Transmission,{transmissionMetrics,assumptionLabels,formatAssumptionValue} from './Transmission.tsx';
import AssumptionControls from './AssumptionControls.tsx';
import ValuationFramework from './ValuationFramework.tsx';
import {startScenarioField} from './scenario-field.ts';
import {startTypeDither} from '../overview/type-dither.ts';
const money=(n:number)=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',notation:'compact',maximumFractionDigits:1}).format(n);
const price=(n:number)=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:2}).format(n);
type CaseId=keyof typeof VALUATION_PRESETS;
const inputKeys=Object.keys(VAL_DEFAULTS) as (keyof ValuationInputs)[];
function changedValue(key:keyof ValuationInputs,value:string|number,other:string|number){
 if(key==='exitDate')return String(value);
 const formatted=formatAssumptionValue(key,Number(value));
 return value!==other&&formatted===formatAssumptionValue(key,Number(other))?String(value):formatted;
}
function inferReference(valuation:ValuationInputs):CaseId|null{
 return buildValuationCases(STARTING,valuation.exitDate).find(c=>inputKeys.every(key=>['institutionalHoldingsPct','holdingsElasticity'].includes(key)||c.inputs[key]===valuation[key]))?.id??null;
}
function readHash(){
 try{
  const match=location.hash.match(/^#s=(.+)$/);if(!match)return null;
  const x=JSON.parse(decodeURIComponent(match[1]));
  if(![MODEL_VERSION,'near-lab-v3'].includes(x.model)||x.baseline!==baseline.version||(x.model===MODEL_VERSION&&x.holdingsBaseline!==HOLDINGS_BASELINE_ID))return null;
  let valuation=cleanValuation(x.valuation,VAL_DEFAULTS);
  if(x.model==='near-lab-v3')valuation=runValuation({...valuation,institutionalHoldingsPct:undefined},STARTING).inputs;
  else runValuation(valuation,STARTING);
  const referenceCase:CaseId|null=x.referenceCase===null?null:typeof x.referenceCase==='string'&&Object.hasOwn(VALUATION_PRESETS,x.referenceCase)?x.referenceCase:inferReference(valuation);
  return {valuation,referenceCase};
 }catch{return null;}
}
export default function LabExperience(){
 const [model,setModel]=useState(()=>readHash()||{valuation:{...VAL_DEFAULTS},referenceCase:'base' as CaseId|null}),[copied,setCopied]=useState(false);
 const {valuation,referenceCase}=model;
 const setValuation=(next:ValuationInputs)=>setModel(current=>({...current,valuation:next}));
 const result=useMemo(()=>runValuation(valuation,STARTING),[valuation]),cases=useMemo(()=>buildValuationCases(STARTING,valuation.exitDate),[valuation.exitDate]);
 const selected=cases.find(c=>inputKeys.every(key=>c.inputs[key]===valuation[key])),reference=cases.find(c=>c.id===referenceCase);
 const changes=reference?inputKeys.filter(key=>reference.inputs[key]!==valuation[key]):[];
 const caseName=reference?`${reference.label}${changes.length?' · modified':''}`:'Custom case',t=result.terminal,m=transmissionMetrics(result);
 const bounds=exitDateBounds(STARTING.asOf),delta=reference?t.futurePriceUsd-reference.result.terminal.futurePriceUsd:0;
 const setExitDate=(exitDate:string)=>{if(exitDate>=bounds.min&&exitDate<=bounds.max)setValuation({...valuation,exitDate});};
 const chooseCase=(id:CaseId)=>setModel(current=>({referenceCase:id,valuation:{...buildValuationCases(STARTING,current.valuation.exitDate).find(c=>c.id===id)!.inputs,institutionalHoldingsPct:current.valuation.institutionalHoldingsPct,holdingsElasticity:current.valuation.holdingsElasticity}}));
 const reset=()=>setModel(current=>{const id=current.referenceCase??'base';return {referenceCase:id,valuation:{...buildValuationCases(STARTING,current.valuation.exitDate).find(c=>c.id===id)!.inputs}};});
 const field=useRef<HTMLCanvasElement>(null),heading=useRef<HTMLHeadingElement>(null),canvas=useRef<HTMLCanvasElement>(null);
 useEffect(()=>startScenarioField(field.current),[]);
 useLayoutEffect(()=>canvas.current&&heading.current?startTypeDither(canvas.current,heading.current):undefined,[]);
 useEffect(()=>{if(location.hash.startsWith('#s='))history.replaceState(null,'',location.pathname+location.search);},[]);
 const share=async()=>{try{const link=location.origin+location.pathname+'#s='+encodeURIComponent(JSON.stringify({model:MODEL_VERSION,baseline:baseline.version,holdingsBaseline:HOLDINGS_BASELINE_ID,referenceCase,valuation}));await navigator.clipboard.writeText(link);setCopied(true);setTimeout(()=>setCopied(false),1600);}catch{setCopied(false);}};
 const exportScenario=()=>{const output={exportedAt:new Date().toISOString(),model:MODEL_VERSION,baseline,institutionalHoldingsBaseline:{source:'https://nrretf.com/',snapshot:institutional.version,issuerDate:institutional.nrr.holdingsIssuerDate,nearHeld:institutional.nrr.nearHeld,scope:'NRR tracked fund inventory, not total institutional ownership'},referenceCase,selectedCase:selected?.id||'custom',valuation,valuationOutputs:result,transmission:m,valuationCases:cases};const url=URL.createObjectURL(new Blob([JSON.stringify(output,null,2)],{type:'application/json'}));const link=document.createElement('a');link.href=url;link.download='near-scenario.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
 return <>
  <section className="lab-hero" aria-labelledby="lab-title"><div className="lab-hero-copy">
   <div className="thesis-resolve"><canvas ref={canvas} aria-hidden="true"/><h1 id="lab-title" ref={heading} aria-label="What makes value endure?"><span>What makes</span> <span>value endure?</span></h1></div>
   <p className="lab-deck">Not all activity creates value, and not all value accrues to the asset enabling it. Examine the conditions under which NEAR's growing execution network becomes a source of durable token demand.</p>
   <p className="lab-case-context">{caseName} · {valuation.exitDate}</p>
   <dl className="lab-hero-stats"><div><dt>Capturable REV at exit</dt><dd>{money(t.totalUsd)}</dd></div><div><dt>Conditional token value</dt><dd>{price(t.futurePriceUsd)}</dd></div><div><dt>Exit REV multiple</dt><dd>{valuation.multiple}×</dd></div></dl>
  </div><figure className="lab-hero-field"><canvas ref={field} aria-hidden="true"/></figure></section>
  <section className="lab-models lab-working" aria-labelledby="working-case-title"><header><h2 id="working-case-title">Choose a case. Trace its value.</h2><p>One working model connects execution, institutional routing, AI services and ETF holdings. Every result follows these shared inputs.</p></header>
   <p className="lab-source-dates">Observed starting inputs · Operations through {baseline.operating.sourceCutoff} · Total supply {STARTING.asOf} · NRR inventory {institutional.nrr.holdingsIssuerDate}. These cutoffs differ; projections begin from the dated snapshot.</p>
   <section id="lab" className="lab-console lab-case-console" aria-label="Selected case controls">
    <div className="lab-console-controls"><div className="lab-presets" role="group" aria-label="Valuation cases">{cases.map(c=><button key={c.id} type="button" aria-pressed={referenceCase===c.id} onClick={()=>chooseCase(c.id)}>{c.label}</button>)}</div>
     <p className="lab-control-hint">Switching cases preserves the ETF inputs. Reset restores all assumptions for the selected reference at this exit.</p>
     <label className="lab-exit-date">Common exit date<input type="date" aria-label="Valuation exit date" min={bounds.min} max={bounds.max} value={valuation.exitDate} onInput={e=>setExitDate(e.currentTarget.value)} onChange={e=>setExitDate(e.currentTarget.value)}/><small>All reference cases use this date.</small></label>
     <AssumptionControls inputs={valuation} onChange={setValuation}/>
     <div className="lab-console-actions"><button type="button" onClick={reset}>Reset {reference?.label||'Base'} assumptions</button><button type="button" onClick={exportScenario}>Export complete model</button><button type="button" onClick={share}>{copied?'Link copied':'Copy model link'}</button></div>
    </div>
    <div className="lab-console-results" aria-live="polite"><p className="lab-console-label">{caseName} · exit {valuation.exitDate}</p><p className="lab-console-big"><span>Conditional token value</span><strong>{price(t.futurePriceUsd)}</strong></p><dl>
     <div><dt>REV-based token value</dt><dd>{price(t.revenuePriceUsd)}</dd></div><div><dt>ETF holdings adjustment</dt><dd>{t.holdingsImpactUsd>=0?'+':''}{price(t.holdingsImpactUsd)}</dd></div><div><dt>Discounted reference today</dt><dd>{price(t.presentPriceUsd)}</dd></div><div><dt>Annual capturable REV</dt><dd>{money(t.totalUsd)}</dd></div><div><dt>Projected total supply</dt><dd>{(t.supplyNear/1e9).toFixed(3)}bn NEAR</dd></div>
    </dl>{reference&&<p className="lab-console-note">{delta>=0?'+':''}{price(delta)} versus {reference.label} at the same exit.</p>}
    </div>
   </section>
   {changes.length>0&&reference&&<details className="lab-changes" open><summary>Changes from {reference.label}</summary><ul>{changes.map(key=><li key={key}><span>{key==='exitDate'?'Exit date':assumptionLabels[key]}</span><strong>{changedValue(key,reference.inputs[key],valuation[key])} → {changedValue(key,valuation[key],reference.inputs[key])}</strong></li>)}</ul></details>}
  </section>
  <ValuationPanel inputs={valuation} onChange={setValuation} caseName={caseName}/>
  <Transmission result={result} inputs={valuation}/>
  <div className="lab-deep-dive"><ValuationFramework inputs={valuation} result={result} starting={STARTING}/></div>
 </>;
}
