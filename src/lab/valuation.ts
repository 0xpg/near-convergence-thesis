export const MODEL_VERSION='near-lab-v2';
export const VALUATION_DEFAULTS={exitDate:'2027-12-31',growthPct:4,capturePct:30.492086110791426,grossBps:15.862722163309982,compression:0,costPct:0,multiple:200,discountPct:26.3,issuancePct:2.5,aiAnnualUsd:0,otherAnnualUsd:0,frontierYears:5};
export type ValuationInputs=typeof VALUATION_DEFAULTS;
export type Starting={asOf:string,annualVolumeUsd:number,annualReceiptsUsd:number,supplyNear:number,spotPriceUsd:number};
export const VALUATION_LIMITS={growthPct:[-10,30,.5],capturePct:[0,100,.5],grossBps:[0,60,.1],compression:[0,1,.05],costPct:[0,100,1],multiple:[10,1000,10],discountPct:[0,100,1],issuancePct:[0,8,.1],aiAnnualUsd:[0,1e10,1e6],otherAnnualUsd:[0,1e10,1e6],frontierYears:[1,15,1]} as const;
export const VALUATION_PRESETS={constrained:{label:'Constrained monetization',inputs:{growthPct:-1,capturePct:20,compression:.25,multiple:100}},execution:{label:'Operating execution',inputs:{growthPct:4,multiple:200}},leadership:{label:'Scale leadership',inputs:{growthPct:8,capturePct:40,compression:.1,multiple:250}}};
function date(value:string){const n=Date.parse(value+'T00:00:00Z');if(!/^\d{4}-\d{2}-\d{2}$/.test(value)||!Number.isFinite(n)||new Date(n).toISOString().slice(0,10)!==value)throw Error('Invalid model date');return n;}
export function cleanValuation(input:Partial<ValuationInputs>={},defaults=VALUATION_DEFAULTS):ValuationInputs{
 const a={...defaults};
 for(const key of Object.keys(VALUATION_LIMITS) as (keyof typeof VALUATION_LIMITS)[]){const v=input[key];if(typeof v!=='number'||!Number.isFinite(v))continue;const [min,max]=VALUATION_LIMITS[key];a[key]=Math.min(max,Math.max(min,v));}
 if(typeof input.exitDate==='string'){try{date(input.exitDate);a.exitDate=input.exitDate;}catch{/* Ignore malformed shared dates. */}}
 return a;
}
export function runValuation(input:Partial<ValuationInputs>,starting:Starting){
 const a=cleanValuation(input),start=date(starting.asOf),end=date(a.exitDate),years=(end-start)/86400000/365;
 if(years<=0||years>15)throw Error('Exit must follow the source date by at most 15 years');
 for(const v of Object.values(starting).filter(v=>typeof v==='number'))if(!Number.isFinite(v)||v<=0)throw Error('Positive finite source inputs required');
 const baseRate=a.grossBps/10000*a.capturePct/100*(1-a.costPct/100),addons=a.aiAnnualUsd+a.otherAnnualUsd;
 const row=(t:number)=>{const scale=(1+a.growthPct/100)**(t*12),volume=starting.annualVolumeUsd*scale,rate=baseRate*(scale>1?scale**-a.compression:1),receipts=volume*rate,supply=starting.supplyNear*(1+a.issuancePct/100)**t,total=receipts+addons*(t/years),future=total*a.multiple/supply;return {years:t,date:new Date(start+t*365*86400000).toISOString().slice(0,10),volumeUsd:volume,intentsUsd:receipts,aiUsd:a.aiAnnualUsd*t/years,otherUsd:a.otherAnnualUsd*t/years,totalUsd:total,supplyNear:supply,futurePriceUsd:future,presentPriceUsd:future/(1+a.discountPct/100)**t};};
 const rows=Array.from({length:Math.ceil(years*12)+1},(_,i)=>row(Math.min(i/12,years))),terminal=rows.at(-1)!;
 const reverse=(target:number,present:boolean)=>{const t=a.frontierYears,supply=starting.supplyNear*(1+a.issuancePct/100)**t,required=target*supply*(present?(1+a.discountPct/100)**t:1)/a.multiple,need=Math.max(0,required-addons),base=starting.annualVolumeUsd*baseRate;let scale:number|null=null;
  if(need===0)scale=0;else if(base>0){const ratio=need/base;if(ratio<=1)scale=ratio;else if(a.compression<1)scale=ratio**(1/(1-a.compression));}
  const volume=scale===null?null:starting.annualVolumeUsd*scale,growth=scale===null?null:((scale**(1/(12*t)))-1)*100;
  return {requiredAnnualUsd:required,requiredVolumeUsd:volume,requiredGrowthPct:growth,reachable:scale!==null&&Number.isFinite(scale),capitalizationUsd:target*supply*(present?(1+a.discountPct/100)**t:1)};};
 return {inputs:a,starting,years,rows,terminal,frontier:[400,450,500].map(target=>({target,future:reverse(target,false),present:reverse(target,true)})),baseAnnualReceiptsUsd:starting.annualReceiptsUsd};
}
