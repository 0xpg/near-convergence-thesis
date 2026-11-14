import baseline from '../../data/lab-baseline.json' with {type:'json'};
import type {ValuationInputs} from './valuation.ts';
import {CaseSlider} from './Transmission.tsx';

export const assumptionGroups=[
 {title:'Execution economics',fields:['growthPct','grossBps','compression','capturePct','costPct'],description:'Base starts from the observed blended fee and receipt / fee ratio. Future growth, fee compression, capture and execution costs remain case assumptions.'},
 {title:'Institutional routing',fields:['institutionalVolumeAnnualUsd','institutionalFeeBps','institutionalCapturePct'],description:'Model incremental fee-paying settlement that is not already counted in existing Intents volume. ETF subscriptions and assets under management are excluded.'},
 {title:'AI services',fields:['aiRevenueAnnualUsd','aiMarginPct','aiTokenLinkPct'],description:'Annual billing × cash margin × protocol allocation. The margin includes AI operating costs; the execution cost haircut is not deducted again.'},
 {title:'Supply and valuation',fields:['issuancePct','multiple','discountPct'],description:'Total supply includes held and newly issued tokens. The exit multiple converts capturable REV to value; the required return discounts that exit value to the snapshot date.'}
] as const;

export default function AssumptionControls({inputs,onChange}:{inputs:ValuationInputs,onChange:(inputs:ValuationInputs)=>void}){
 const hint=(name:string)=>name==='growthPct'?`${(((1+inputs.growthPct/100)**12-1)*100).toFixed(1)}% compounded annually at the selected monthly rate.`:
  name==='compression'?'Compression applies above starting volume. Zero keeps the fee unchanged as volume scales.':
  name==='costPct'?'Deducted once after fee capture for Intents and institutional routing.':
  name==='issuancePct'?`The archived protocol maximum is ${baseline.supply.issuancePct}%. Higher stress values assume a future policy change.`:
  name==='multiple'?'Applied to annual capturable REV at exit; this is a scenario assumption, not a fitted terminal multiple.':
  name==='discountPct'?'Discounts the exit token value; interim distributions are not added.':'';
 return <div className="lab-assumption-groups">{assumptionGroups.map(group=><details className="lab-assumption-group" key={group.title}><summary>{group.title}</summary><p className="lab-assumption-copy">{group.description}</p><div className="lab-console-sliders">{group.fields.map(name=><div key={name}><CaseSlider name={name} inputs={inputs} onChange={onChange}/>{hint(name)&&<p className="lab-control-hint">{hint(name)}</p>}</div>)}</div></details>)}</div>;
}
