export const MODEL_VERSION='near-lab-v4';
export const VALUATION_DEFAULTS={
 exitDate:'2031-12-31',growthPct:4,capturePct:30.492086110791426,grossBps:15.862722163309982,
 compression:0,costPct:0,multiple:200,discountPct:26.3,issuancePct:2.5,
 institutionalVolumeAnnualUsd:0,institutionalFeeBps:3,institutionalCapturePct:35,
 institutionalHoldingsPct:0,holdingsElasticity:1,
 aiRevenueAnnualUsd:0,aiMarginPct:25,aiTokenLinkPct:25
};
export type ValuationInputs=typeof VALUATION_DEFAULTS;
export type Starting={asOf:string,annualVolumeUsd:number,annualReceiptsUsd:number,supplyNear:number,spotPriceUsd:number,grossBps?:number,capturePct?:number,institutionalHoldingsNear?:number};
export const VALUATION_LIMITS={
 growthPct:[-10,30,.5],capturePct:[0,100,.5],grossBps:[0,60,.1],compression:[0,1,.05],costPct:[0,100,1],
 multiple:[10,1000,10],discountPct:[0,100,1],issuancePct:[0,8,.1],
 institutionalVolumeAnnualUsd:[0,1e14,1e10],institutionalFeeBps:[0,60,.1],institutionalCapturePct:[0,100,.5],
 institutionalHoldingsPct:[0,80,.25],holdingsElasticity:[.25,5,.25],
 aiRevenueAnnualUsd:[0,1e11,1e7],aiMarginPct:[0,100,.5],aiTokenLinkPct:[0,100,.5]
} as const;
export const VALUATION_PRESETS={
 bear:{label:'Bear',inputs:{growthPct:-1,capturePct:20,grossBps:12,costPct:15,multiple:100}},
 base:{label:'Base',inputs:{growthPct:4,costPct:10,multiple:200,institutionalVolumeAnnualUsd:250e9,institutionalFeeBps:3,institutionalCapturePct:35,aiRevenueAnnualUsd:200e6,aiMarginPct:25,aiTokenLinkPct:25}},
 bull:{label:'Bull',inputs:{growthPct:6,grossBps:14,capturePct:40,compression:.1,costPct:10,multiple:250,institutionalVolumeAnnualUsd:1e12,institutionalFeeBps:3,institutionalCapturePct:40,aiRevenueAnnualUsd:2e9,aiMarginPct:35,aiTokenLinkPct:50}},
 maximum:{label:'Maximum ($400)',inputs:{growthPct:8,grossBps:12,capturePct:45,compression:.1,costPct:10,multiple:250,institutionalVolumeAnnualUsd:2e12,institutionalFeeBps:3,institutionalCapturePct:45,aiMarginPct:40,aiTokenLinkPct:50}}
};
function date(value:string){
 const n=Date.parse(value+'T00:00:00Z');
 if(!/^\d{4}-\d{2}-\d{2}$/.test(value)||!Number.isFinite(n)||new Date(n).toISOString().slice(0,10)!==value)throw Error('Invalid model date');
 return n;
}
export const exitDateBounds=(asOf:string)=>({min:new Date(date(asOf)+86400000).toISOString().slice(0,10),max:new Date(date(asOf)+15*365*86400000).toISOString().slice(0,10)});
export function cleanValuation(input:Partial<ValuationInputs>={},defaults=VALUATION_DEFAULTS):ValuationInputs{
 const a={...defaults};
 for(const key of Object.keys(VALUATION_LIMITS) as (keyof typeof VALUATION_LIMITS)[]){
  const v=input[key];if(typeof v!=='number'||!Number.isFinite(v))continue;
  const [min,max]=VALUATION_LIMITS[key];a[key]=Math.min(max,Math.max(min,v));
 }
 if(typeof input.exitDate==='string'){try{date(input.exitDate);a.exitDate=input.exitDate;}catch{/* Ignore malformed shared dates. */}}
 return a;
}
export function runValuation(input:Partial<ValuationInputs>,starting:Starting){
 const a=cleanValuation(input),start=date(starting.asOf),end=date(a.exitDate),years=(end-start)/86400000/365;
 if(years<=0||years>15)throw Error('Exit must follow the source date by at most 15 years');
 for(const key of ['annualVolumeUsd','annualReceiptsUsd','supplyNear','spotPriceUsd'] as const){
  const v=starting[key];if(typeof v!=='number'||!Number.isFinite(v)||v<=0)throw Error('Positive finite source inputs required');
 }
 const holdingsStart=starting.institutionalHoldingsNear??0,terminalSupply=starting.supplyNear*(1+a.issuancePct/100)**years;
 if(!Number.isFinite(holdingsStart)||holdingsStart<0||holdingsStart>=starting.supplyNear)throw Error('Tracked holdings must be nonnegative and below total supply');
 if(input.institutionalHoldingsPct===undefined)a.institutionalHoldingsPct=holdingsStart/terminalSupply*100;
 const holdingsTarget=terminalSupply*a.institutionalHoldingsPct/100;
 const institutionalGross=a.institutionalVolumeAnnualUsd*a.institutionalFeeBps/10000;
 const institutionalReceipts=institutionalGross*a.institutionalCapturePct/100*(1-a.costPct/100);
 const aiReceipts=a.aiRevenueAnnualUsd*a.aiMarginPct/100*a.aiTokenLinkPct/100;
 const row=(t:number)=>{
  const ramp=t/years,scale=(1+a.growthPct/100)**(t*12),volume=starting.annualVolumeUsd*scale;
  const effectiveGrossBps=a.grossBps*(scale>1?scale**-a.compression:1),grossIntentsUsd=volume*effectiveGrossBps/10000;
  const intentsUsd=grossIntentsUsd*a.capturePct/100*(1-a.costPct/100),institutionalUsd=institutionalReceipts*ramp,aiUsd=aiReceipts*ramp;
  const supplyNear=starting.supplyNear*(1+a.issuancePct/100)**t,totalUsd=intentsUsd+institutionalUsd+aiUsd,capitalizationUsd=totalUsd*a.multiple,revenuePriceUsd=capitalizationUsd/supplyNear;
  const institutionalHeldNear=holdingsStart+(holdingsTarget-holdingsStart)*ramp,otherHolderNear=supplyNear-institutionalHeldNear;
  if(otherHolderNear<=0)throw Error('Tracked holdings must remain below total supply');
  const holdingsMultiplier=((supplyNear-holdingsStart)/otherHolderNear)**(1/a.holdingsElasticity),futurePriceUsd=revenuePriceUsd*holdingsMultiplier;
  return {years:t,date:new Date(start+t*365*86400000).toISOString().slice(0,10),volumeUsd:volume,effectiveGrossBps,grossIntentsUsd,intentsUsd,
   institutionalVolumeUsd:a.institutionalVolumeAnnualUsd*ramp,grossInstitutionalUsd:institutionalGross*ramp,institutionalUsd,
   aiGrossUsd:a.aiRevenueAnnualUsd*ramp,aiUsd,totalUsd,supplyNear,capitalizationUsd,revenuePriceUsd,revenuePresentPriceUsd:revenuePriceUsd/(1+a.discountPct/100)**t,
   institutionalHeldNear,otherHolderNear,holdingsMultiplier,holdingsImpactUsd:futurePriceUsd-revenuePriceUsd,conditionalCapitalizationUsd:futurePriceUsd*supplyNear,futurePriceUsd,presentPriceUsd:futurePriceUsd/(1+a.discountPct/100)**t};
 };
 const rows=Array.from({length:Math.ceil(years*12)+1},(_,i)=>row(Math.min(i/12,years))),terminal=rows.at(-1)!;
 return {inputs:a,starting,years,rows,terminal,baseAnnualReceiptsUsd:starting.annualReceiptsUsd};
}

export function buildValuationCases(starting:Starting,exitDate=VALUATION_DEFAULTS.exitDate){
 const defaults={...VALUATION_DEFAULTS,exitDate};
 defaults.institutionalHoldingsPct=(starting.institutionalHoldingsNear??0)/(starting.supplyNear*(1+defaults.issuancePct/100)**((date(exitDate)-date(starting.asOf))/86400000/365))*100;
 if(starting.grossBps!==undefined){if(!Number.isFinite(starting.grossBps)||starting.grossBps<=0||starting.grossBps>60)throw Error('Invalid observed gross fee rate');defaults.grossBps=starting.grossBps;}
 if(starting.capturePct!==undefined){if(!Number.isFinite(starting.capturePct)||starting.capturePct<0||starting.capturePct>100)throw Error('Invalid observed cash capture');defaults.capturePct=starting.capturePct;}
 return (Object.entries(VALUATION_PRESETS) as [keyof typeof VALUATION_PRESETS,typeof VALUATION_PRESETS[keyof typeof VALUATION_PRESETS]][]).map(([id,preset])=>{
  let inputs:ValuationInputs={...defaults,...preset.inputs};
  const uncalibrated=runValuation(inputs,starting);
  if(id!=='maximum')return {id,label:preset.label,inputs,result:uncalibrated,calibration:null};
  const targetFuturePriceUsd=400,requiredAnnualReceiptsUsd=targetFuturePriceUsd*uncalibrated.terminal.supplyNear/inputs.multiple;
  const incrementalAiReceipts=Math.max(0,requiredAnnualReceiptsUsd-uncalibrated.terminal.intentsUsd-uncalibrated.terminal.institutionalUsd);
  const requiredAiRevenueAnnualUsd=incrementalAiReceipts/(inputs.aiMarginPct/100*inputs.aiTokenLinkPct/100);
  // Only AI billing is solved to the stated hypothesis; the resulting price is never capped.
  inputs=cleanValuation({...inputs,aiRevenueAnnualUsd:requiredAiRevenueAnnualUsd});
  const result=runValuation(inputs,starting),withoutIncremental=runValuation({...inputs,aiTokenLinkPct:0,institutionalVolumeAnnualUsd:0},starting);
  const status=uncalibrated.terminal.futurePriceUsd>targetFuturePriceUsd?'already-above-target':requiredAiRevenueAnnualUsd>VALUATION_LIMITS.aiRevenueAnnualUsd[1]?'outside-input-range':'calibrated';
  return {id,label:preset.label,inputs,result,calibration:{targetFuturePriceUsd,solvedInput:'aiRevenueAnnualUsd',requiredAnnualReceiptsUsd,requiredAiRevenueAnnualUsd,
   unlinkedFuturePriceUsd:uncalibrated.terminal.futurePriceUsd,withoutIncrementalFuturePriceUsd:withoutIncremental.terminal.futurePriceUsd,
   achievedFuturePriceUsd:result.terminal.futurePriceUsd,targetGapUsd:result.terminal.futurePriceUsd-targetFuturePriceUsd,status,
   assumptionStatus:'target-calibrated, not independently estimated'}};
 });
}
