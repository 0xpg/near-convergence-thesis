import baseline from '../../data/lab-baseline.json' with {type:'json'};
import institutional from '../../data/institutional-demand.json' with {type:'json'};
import {STARTING,VAL_DEFAULTS,HOLDINGS_BASELINE_ID} from './baseline.ts';
import {MODEL_VERSION,VALUATION_PRESETS,cleanValuation,runValuation,buildValuationCases,type ValuationInputs} from './valuation.ts';
import type {transmissionMetrics} from './Transmission.tsx';

export type CaseId=keyof typeof VALUATION_PRESETS;
type Model={valuation:ValuationInputs,referenceCase:CaseId|null};
const inputKeys=Object.keys(VAL_DEFAULTS) as (keyof ValuationInputs)[];
function inferReference(valuation:ValuationInputs):CaseId|null{
 return buildValuationCases(STARTING,valuation.exitDate).find(c=>inputKeys.every(key=>['institutionalHoldingsPct','holdingsElasticity'].includes(key)||c.inputs[key]===valuation[key]))?.id??null;
}
export function readModelHash(hash:string){
 try{
  const match=hash.match(/^#s=(.+)$/);if(!match)return null;
  const x=JSON.parse(decodeURIComponent(match[1]));
  if(![MODEL_VERSION,'near-lab-v3'].includes(x.model)||x.baseline!==baseline.version||(x.model===MODEL_VERSION&&x.holdingsBaseline!==HOLDINGS_BASELINE_ID))return null;
  let valuation=cleanValuation(x.valuation,VAL_DEFAULTS);
  if(x.model==='near-lab-v3')valuation=runValuation({...valuation,institutionalHoldingsPct:undefined},STARTING).inputs;
  else runValuation(valuation,STARTING);
  const referenceCase:CaseId|null=x.referenceCase===null?null:typeof x.referenceCase==='string'&&Object.hasOwn(VALUATION_PRESETS,x.referenceCase)?x.referenceCase:inferReference(valuation);
  return {valuation,referenceCase};
 }catch{return null;}
}

export function modelHash({valuation,referenceCase}:Model){
 return '#s='+encodeURIComponent(JSON.stringify({model:MODEL_VERSION,baseline:baseline.version,holdingsBaseline:HOLDINGS_BASELINE_ID,referenceCase,valuation}));
}

export function modelExport({valuation,referenceCase}:Model,result:ReturnType<typeof runValuation>,m:ReturnType<typeof transmissionMetrics>,cases:ReturnType<typeof buildValuationCases>,selectedCase:CaseId|undefined,exportedAt:string){
 return {exportedAt,model:MODEL_VERSION,baseline,institutionalHoldingsBaseline:{source:'https://nrretf.com/',snapshot:institutional.version,issuerDate:institutional.nrr.holdingsIssuerDate,nearHeld:institutional.nrr.nearHeld,scope:'NRR tracked fund inventory, not total institutional ownership'},referenceCase,selectedCase:selectedCase||'custom',valuation,valuationOutputs:result,transmission:m,valuationCases:cases};
}
