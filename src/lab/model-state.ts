import baseline from '../../data/lab-baseline.json' with {type:'json'};
import institutional from '../../data/institutional-demand.json' with {type:'json'};
import {STARTING,VAL_DEFAULTS,HOLDINGS_BASELINE_ID} from './baseline.ts';
import {MODEL_VERSION,VALUATION_PRESETS,cleanValuation,runValuation,buildValuationCases,AI_PRICING_REFERENCE,INSTITUTIONAL_ROUTE_MIX,CASE_OPERATING_DRIVERS,type ValuationInputs} from './valuation.ts';
import type {transmissionMetrics} from './Transmission.tsx';

export type CaseId=keyof typeof VALUATION_PRESETS;
type Model={valuation:ValuationInputs,referenceCase:CaseId|null};
const inputKeys=Object.keys(VAL_DEFAULTS) as (keyof ValuationInputs)[];
const LEGACY_DEFAULTS:ValuationInputs={exitDate:'2031-12-31',growthPct:4,capturePct:30.492086110791426,grossBps:15.862722163309982,compression:0,costPct:10,multiple:200,discountPct:26.3,issuancePct:2.5,institutionalVolumeAnnualUsd:250e9,institutionalFeeBps:3,institutionalCapturePct:35,institutionalHoldingsPct:VAL_DEFAULTS.institutionalHoldingsPct,holdingsElasticity:1,aiRevenueAnnualUsd:200e6,aiMarginPct:25,aiTokenLinkPct:25};
export const PRESET_ASSUMPTIONS={pricing:AI_PRICING_REFERENCE,routeMix:INSTITUTIONAL_ROUTE_MIX,operatingDrivers:CASE_OPERATING_DRIVERS};
export function modelAtExit(model:Model,exitDate:string):Model{
 const {valuation,referenceCase}=model;
 const previous=buildValuationCases(STARTING,valuation.exitDate).find(c=>c.id===referenceCase),next=buildValuationCases(STARTING,exitDate).find(c=>c.id===referenceCase);
 const updated={...valuation,exitDate};
 if(previous&&next){
  for(const key of ['aiRevenueAnnualUsd','institutionalHoldingsPct'] as const)if(valuation[key]===previous.inputs[key])updated[key]=next.inputs[key];
 }
 return {...model,valuation:updated};
}

function inferReference(valuation:ValuationInputs):CaseId|null{
 return buildValuationCases(STARTING,valuation.exitDate).find(c=>inputKeys.every(key=>['institutionalHoldingsPct','holdingsElasticity'].includes(key)||c.inputs[key]===valuation[key]))?.id??null;
}
export function readModelHash(hash:string){
 try{
  const match=hash.match(/^#s=(.+)$/);if(!match)return null;
  const x=JSON.parse(decodeURIComponent(match[1]));
  if(![MODEL_VERSION,'near-lab-v4','near-lab-v3'].includes(x.model)||x.baseline!==baseline.version||(x.model!=='near-lab-v3'&&x.holdingsBaseline!==HOLDINGS_BASELINE_ID))return null;
  const legacy=x.model!==MODEL_VERSION;
  let valuation=cleanValuation(x.valuation,legacy?LEGACY_DEFAULTS:VAL_DEFAULTS);
  if(x.model==='near-lab-v3')valuation=runValuation({...valuation,institutionalHoldingsPct:undefined},STARTING).inputs;
  else runValuation(valuation,STARTING);
  const referenceCase:CaseId|null=legacy||x.referenceCase===null?null:typeof x.referenceCase==='string'&&Object.hasOwn(VALUATION_PRESETS,x.referenceCase)?x.referenceCase:inferReference(valuation);
  return {valuation,referenceCase};
 }catch{return null;}
}

export function modelHash({valuation,referenceCase}:Model){
 return '#s='+encodeURIComponent(JSON.stringify({model:MODEL_VERSION,baseline:baseline.version,holdingsBaseline:HOLDINGS_BASELINE_ID,referenceCase,valuation}));
}

export function modelExport({valuation,referenceCase}:Model,result:ReturnType<typeof runValuation>,m:ReturnType<typeof transmissionMetrics>,cases:ReturnType<typeof buildValuationCases>,selectedCase:CaseId|undefined,exportedAt:string){
 return {exportedAt,model:MODEL_VERSION,baseline,presetAssumptions:PRESET_ASSUMPTIONS,institutionalHoldingsBaseline:{source:'https://nrretf.com/',snapshot:institutional.version,issuerDate:institutional.nrr.holdingsIssuerDate,nearHeld:institutional.nrr.nearHeld,scope:'NRR tracked fund inventory, not total institutional ownership'},referenceCase,selectedCase:selectedCase||'custom',valuation,valuationOutputs:result,transmission:m,valuationCases:cases};
}
