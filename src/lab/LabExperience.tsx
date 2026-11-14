import {useEffect,useLayoutEffect,useMemo,useRef,useState} from 'react';
import baseline from '../../data/lab-baseline.json' with {type:'json'};
import institutional from '../../data/institutional-demand.json' with {type:'json'};
import ValuationPanel,{STARTING,VAL_DEFAULTS,HOLDINGS_BASELINE_ID} from './ValuationPanel.tsx';
import {MODEL_VERSION,cleanValuation,runValuation,buildValuationCases,type ValuationInputs} from './valuation.ts';
import Transmission,{CaseSlider,transmissionMetrics} from './Transmission.tsx';
import ValuationFramework from './ValuationFramework.tsx';
import {startScenarioField} from './scenario-field.ts';
import {startTypeDither} from '../overview/type-dither.ts';
const money=(n:number)=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',notation:'compact',maximumFractionDigits:1}).format(n);
const price=(n:number)=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:2}).format(n);
function readHash(){
 try{const match=location.hash.match(/^#s=(.+)$/);if(!match)return null;const x=JSON.parse(decodeURIComponent(match[1]));if(![MODEL_VERSION,'near-lab-v3'].includes(x.model)||x.baseline!==baseline.version||(x.model===MODEL_VERSION&&x.holdingsBaseline!==HOLDINGS_BASELINE_ID))return null;const valuation=cleanValuation(x.valuation,VAL_DEFAULTS);if(x.model==='near-lab-v3')return runValuation({...valuation,institutionalHoldingsPct:undefined},STARTING).inputs;runValuation(valuation,STARTING);return valuation;}catch{return null;}
}
export default function LabExperience(){
 const [valuation,setValuation]=useState<ValuationInputs>(()=>readHash()||{...VAL_DEFAULTS}),[copied,setCopied]=useState(false);
 const result=useMemo(()=>runValuation(valuation,STARTING),[valuation]),cases=useMemo(()=>buildValuationCases(STARTING,valuation.exitDate),[valuation.exitDate]);
 const selected=cases.find(c=>(Object.keys(valuation) as (keyof ValuationInputs)[]).every(key=>c.inputs[key]===valuation[key])),caseName=selected?.label||'Custom case',t=result.terminal,m=transmissionMetrics(result);
 const field=useRef<HTMLCanvasElement>(null),heading=useRef<HTMLHeadingElement>(null),canvas=useRef<HTMLCanvasElement>(null);
 useEffect(()=>startScenarioField(field.current),[]);
 useLayoutEffect(()=>canvas.current&&heading.current?startTypeDither(canvas.current,heading.current):undefined,[]);
 useEffect(()=>{const hash='#s='+encodeURIComponent(JSON.stringify({model:MODEL_VERSION,baseline:baseline.version,holdingsBaseline:HOLDINGS_BASELINE_ID,valuation}));if(location.hash!==hash)history.replaceState(null,'',location.pathname+location.search+hash);},[valuation]);
 const share=async()=>{try{await navigator.clipboard.writeText(location.href);setCopied(true);setTimeout(()=>setCopied(false),1600);}catch{setCopied(false);}};
 const exportScenario=()=>{const output={exportedAt:new Date().toISOString(),model:MODEL_VERSION,baseline,institutionalHoldingsBaseline:{source:'https://nrretf.com/',snapshot:institutional.version,issuerDate:institutional.nrr.holdingsIssuerDate,nearHeld:institutional.nrr.nearHeld,scope:'NRR tracked fund inventory, not total institutional ownership'},selectedCase:selected?.id||'custom',valuation,valuationOutputs:result,transmission:m,valuationCases:cases};const url=URL.createObjectURL(new Blob([JSON.stringify(output,null,2)],{type:'application/json'}));const link=document.createElement('a');link.href=url;link.download='near-scenario.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
 return <>
  <section className="lab-hero" aria-labelledby="lab-title"><div className="lab-hero-copy">
   <div className="thesis-resolve"><canvas ref={canvas} aria-hidden="true"/><h1 id="lab-title" ref={heading} aria-label="What makes value endure?"><span>What makes</span> <span>value endure?</span></h1></div>
   <p className="lab-deck">Not all activity creates value, and not all value accrues to the asset enabling it. Examine the conditions under which NEAR's growing execution network becomes a source of durable token demand.</p>
   <p className="lab-case-context">{caseName} · {valuation.exitDate}</p>
   <dl className="lab-hero-stats"><div><dt>Capturable REV at exit</dt><dd>{money(t.totalUsd)}</dd></div><div><dt>Conditional token value</dt><dd>{price(t.futurePriceUsd)}</dd></div><div><dt>Exit REV multiple</dt><dd>{valuation.multiple}×</dd></div></dl>
  </div><figure className="lab-hero-field"><canvas ref={field} aria-hidden="true"/></figure></section>
  <section className="lab-models lab-holdings" aria-labelledby="holdings-title"><header><h2 id="holdings-title">Capital that chooses to stay.</h2><p>ETF accumulation changes the holdings assumption, not protocol revenue. Set the tracked-fund target and examine the conditional price alongside the REV anchor.</p></header><div className="lab-console-controls">
   <p className="lab-holdings-source"><a href="https://nrretf.com/">NRR issuer snapshot</a> · {institutional.nrr.holdingsIssuerDate} · {new Intl.NumberFormat('en-US',{maximumFractionDigits:0}).format(institutional.nrr.nearHeld)} NEAR held. This single-product anchor is not a census of institutional ownership; holdings and total supply have different cutoffs.</p>
   <div className="lab-console-sliders">{(['institutionalHoldingsPct','holdingsElasticity'] as const).map(name=><CaseSlider key={name} name={name} inputs={valuation} onChange={setValuation}/>)}</div>
   <dl className="lab-holdings-results"><div><dt>REV-based token value</dt><dd>{price(t.revenuePriceUsd)}</dd></div><div><dt>Holdings demand effect</dt><dd>{t.holdingsImpactUsd>=0?'+':''}{price(t.holdingsImpactUsd)}</dd></div><div><dt>Conditional token value</dt><dd>{price(t.futurePriceUsd)}</dd></div><div><dt>Tracked holdings at exit</dt><dd>{money(t.institutionalHeldNear).replace('$','')} NEAR</dd></div></dl>
   <p className="lab-holdings-source">The selected target requires {new Intl.NumberFormat('en-US',{maximumFractionDigits:0,signDisplay:'always'}).format(t.institutionalHeldNear-institutional.nrr.nearHeld)} NEAR of net inventory change by {valuation.exitDate}. That is a token-quantity assumption, not a measured future subscription flow.</p>
   <p className="lab-holdings-source">Defaults hold the tracked token inventory unchanged. Elasticity is a selected response of other holders, not an estimated NEAR coefficient. Holdings are redeemable, not burned; a higher target only changes price under this stated demand assumption. The exit multiple is held fixed so this is a counterfactual, not an independently additive fair-value claim.</p>
  </div></section>
  <ValuationPanel inputs={valuation} onChange={setValuation}/>
  <ValuationFramework inputs={valuation} result={result} starting={STARTING}/>
  <section id="lab" className="lab-console lab-case-console" aria-label="Selected case controls">
   <div className="lab-console-controls"><div className="lab-presets" role="group" aria-label="Transmission cases">{cases.map(c=><button key={c.id} type="button" aria-pressed={selected?.id===c.id} onClick={()=>setValuation({...c.inputs})}>{c.label}</button>)}</div>
    <div className="lab-console-sliders">{(['growthPct','capturePct','institutionalHoldingsPct','holdingsElasticity','aiTokenLinkPct','multiple'] as const).map(name=><CaseSlider key={name} name={name} inputs={valuation} onChange={setValuation}/>)}</div>
    <div className="lab-console-actions"><button type="button" onClick={()=>setValuation({...cases.find(c=>c.id==='base')!.inputs})}>Reset to Base</button><button type="button" onClick={exportScenario}>Export complete model</button><button type="button" onClick={share}>{copied?'Link copied':'Copy model link'}</button></div>
   </div>
   <div className="lab-console-results" aria-live="polite"><p className="lab-console-label">{caseName} · annualized at {valuation.exitDate}</p><p className="lab-console-big"><span>Capturable REV</span><strong>{money(t.totalUsd)}</strong></p><dl>
    <div><dt>Intents REV</dt><dd>{money(t.intentsUsd)}</dd></div><div><dt>Institutional routing REV</dt><dd>{money(t.institutionalUsd)}</dd></div><div><dt>AI protocol cash</dt><dd>{money(t.aiUsd)}</dd></div><div><dt>Settlement volume</dt><dd>{money(m.volumeUsd)}</dd></div><div><dt>Projected total supply</dt><dd>{(t.supplyNear/1e9).toFixed(3)}bn NEAR</dd></div><div><dt>REV-based token value</dt><dd>{price(t.revenuePriceUsd)}</dd></div><div><dt>Holdings demand effect</dt><dd>{t.holdingsImpactUsd>=0?'+':''}{price(t.holdingsImpactUsd)}</dd></div><div><dt>Conditional token value</dt><dd>{price(t.futurePriceUsd)}</dd></div>
   </dl></div>
  </section>
  <Transmission result={result} inputs={valuation} onChange={setValuation}/>
 </>;
}
