import {formatUsdCompact} from './format.ts';
export type DailyObservation={
  day:string; volumeUsd:number; grossFeesUsd:number; capturedUsd:number;
  swaps?:number|null; transactions?:number|null; emissionsNear?:number|null; totalRevenueNear?:number|null;
};
export const ANALYTICS_VERSION='glance-analytics-2026-11-12-v1';
export type WindowMetrics={
  volumeUsd:number; grossFeesUsd:number; capturedUsd:number; residualUsd:number;
  grossBps:number|null; capturedBps:number|null; captureSharePct:number|null;
  retainedPerMillionUsd:number|null; averageSwapUsd:number|null; swaps:number|null;
  averageDailyTransactions:number|null; revenuePctIssuance:number|null;
  medianDailyVolumeUsd:number; top5DaysVolumeSharePct:number|null;
};
export type WindowAnalysis={
  status:'ready'|'unavailable'; quality:{errors:string[];warnings:string[]};
  window:{start:string;end:string;days:number}; previousWindow:{start:string;end:string;days:number};
  current:WindowMetrics|null; previous:WindowMetrics|null;
  changes:{volumePct:number|null;grossFeesPct:number|null;capturedPct:number|null;capturedBpsDelta:number|null;captureSharePp:number|null}|null;
  decomposition:{volumeEffectUsd:number;captureRateEffectUsd:number;totalChangeUsd:number}|null;
  series:DailyObservation[]; headline:string; commentary:string;
};

const DAY=86_400_000;
function stamp(value:string):number|null{
  if(!/^\d{4}-\d{2}-\d{2}$/.test(value))return null;
  const time=Date.parse(value+'T00:00:00Z');
  return Number.isFinite(time)&&new Date(time).toISOString().slice(0,10)===value?time:null;
}
const date=(time:number)=>new Date(time).toISOString().slice(0,10);
const ratio=(a:number,b:number,multiplier=1)=>b===0?null:a/b*multiplier;
const change=(a:number,b:number)=>b===0?null:(a/b-1)*100;
const delta=(a:number|null,b:number|null)=>a===null||b===null?null:a-b;
function sum(values:number[]):number{
  let total=0,correction=0;
  for(const value of values){const adjusted=value-correction,next=total+adjusted;correction=(next-total)-adjusted;total=next;}
  return total;
}
function metrics(rows:DailyObservation[]):WindowMetrics{
  const volumeUsd=sum(rows.map(row=>row.volumeUsd)),grossFeesUsd=sum(rows.map(row=>row.grossFeesUsd)),capturedUsd=sum(rows.map(row=>row.capturedUsd));
  const optional=(key:'swaps'|'transactions'|'emissionsNear'|'totalRevenueNear')=>rows.every(row=>typeof row[key]==='number')?sum(rows.map(row=>row[key] as number)):null;
  const swaps=optional('swaps'),transactions=optional('transactions'),issuance=optional('emissionsNear'),revenue=optional('totalRevenueNear');
  const ordered=rows.map(row=>row.volumeUsd).sort((a,b)=>a-b),middle=Math.floor(ordered.length/2);
  return {volumeUsd,grossFeesUsd,capturedUsd,residualUsd:grossFeesUsd-capturedUsd,
    grossBps:ratio(grossFeesUsd,volumeUsd,1e4),capturedBps:ratio(capturedUsd,volumeUsd,1e4),captureSharePct:ratio(capturedUsd,grossFeesUsd,100),
    retainedPerMillionUsd:ratio(capturedUsd,volumeUsd,1e6),swaps,averageSwapUsd:swaps===null?null:ratio(volumeUsd,swaps),
    averageDailyTransactions:transactions===null?null:transactions/rows.length,revenuePctIssuance:revenue===null||issuance===null?null:ratio(revenue,issuance,100),
    medianDailyVolumeUsd:ordered.length%2?ordered[middle]:(ordered[middle-1]+ordered[middle])/2,
    top5DaysVolumeSharePct:ratio(sum(ordered.slice(-5)),volumeUsd,100)};
}
const money=(value:number)=>formatUsdCompact(value,2);
const movement=(value:number|null)=>value===null?'has no comparable nonzero baseline':Math.abs(value)<.05?'was broadly unchanged':`${value>0?'rose':'fell'} ${Math.abs(value).toFixed(1)}%`;

export function analyzeWindow(rows:DailyObservation[],options:{days:number;end?:string;asOf:string}):WindowAnalysis{
  const errors:string[]=[],warnings:string[]=[],asOf=stamp(options.asOf);
  const result:WindowAnalysis={status:'unavailable',quality:{errors,warnings},window:{start:'',end:options.end||'',days:options.days},previousWindow:{start:'',end:'',days:options.days},current:null,previous:null,changes:null,decomposition:null,series:[],headline:'Observation unavailable',commentary:'A complete, valid source window is required before drawing an investment inference.'};
  if(asOf===null)errors.push('Invalid UTC as-of date.');
  if(!Number.isInteger(options.days)||options.days<1||options.days>366)errors.push('Window must contain 1 to 366 completed UTC days.');
  const byDay=new Map<string,DailyObservation>();
  for(const row of rows){
    if(!row||typeof row!=='object'){errors.push('Invalid daily source row.');continue;}
    if(stamp(row.day)===null){errors.push('Invalid UTC source date: '+row.day);continue;}
    if(byDay.has(row.day))errors.push('Duplicate source date: '+row.day);
    byDay.set(row.day,row);
    for(const key of ['volumeUsd','grossFeesUsd','capturedUsd'] as const){
      if(typeof row[key]!=='number'||!Number.isFinite(row[key])||row[key]<0||row[key]>Number.MAX_SAFE_INTEGER)errors.push('Invalid '+key+' on '+row.day);
    }
    for(const key of ['swaps','transactions','emissionsNear','totalRevenueNear'] as const){
      const value=row[key];
      if(value!=null&&(!Number.isFinite(value)||value<0||value>Number.MAX_SAFE_INTEGER||((key==='swaps'||key==='transactions')&&!Number.isSafeInteger(value))))errors.push('Invalid '+key+' on '+row.day);
    }
  }
  if(errors.length||asOf===null)return result;
  const completed=[...byDay.keys()].filter(day=>(stamp(day) as number)<asOf).sort();
  const end=options.end||completed[completed.length-1]||date(asOf-DAY),endTime=stamp(end);
  if(endTime===null||endTime>=asOf){errors.push('End date must precede the UTC as-of date.');return result;}
  const startTime=endTime-(options.days-1)*DAY,previousEnd=startTime-DAY,previousStart=startTime-options.days*DAY;
  result.window={start:date(startTime),end,days:options.days};
  result.previousWindow={start:date(previousStart),end:date(previousEnd),days:options.days};
  const dates=(first:number)=>Array.from({length:options.days},(_,index)=>date(first+index*DAY));
  const currentDates=dates(startTime),missing=currentDates.filter(day=>!byDay.has(day));
  if(missing.length){errors.push(`Missing ${missing.length} of ${options.days} current-window dates: ${missing.slice(0,3).join(', ')}${missing.length>3?'…':''}`);return result;}
  result.series=currentDates.map(day=>byDay.get(day) as DailyObservation);
  const current=result.current=metrics(result.series);
  const previousDates=dates(previousStart),previousMissing=previousDates.filter(day=>!byDay.has(day));
  if(previousMissing.length)warnings.push(`Prior ${options.days}-day comparison unavailable: ${previousMissing.length} missing dates.`);
  else{
    const previous=result.previous=metrics(previousDates.map(day=>byDay.get(day) as DailyObservation));
    result.changes={volumePct:change(current.volumeUsd,previous.volumeUsd),grossFeesPct:change(current.grossFeesUsd,previous.grossFeesUsd),capturedPct:change(current.capturedUsd,previous.capturedUsd),capturedBpsDelta:delta(current.capturedBps,previous.capturedBps),captureSharePp:delta(current.captureSharePct,previous.captureSharePct)};
    if(current.volumeUsd>0&&previous.volumeUsd>0){
      const oldRate=previous.capturedUsd/previous.volumeUsd,newRate=current.capturedUsd/current.volumeUsd;
      // Average both replacement orders so the interaction is shared and contributions reconcile exactly.
      result.decomposition={volumeEffectUsd:(current.volumeUsd-previous.volumeUsd)*(oldRate+newRate)/2,captureRateEffectUsd:(newRate-oldRate)*(current.volumeUsd+previous.volumeUsd)/2,totalChangeUsd:current.capturedUsd-previous.capturedUsd};
    }
  }
  if(endTime<asOf-DAY)warnings.push(`Source cutoff ${end} is earlier than the last completed UTC day ${date(asOf-DAY)}.`);
  if(current.residualUsd<0)warnings.push('Captured receipts exceed gross fees in this window; sweep timing must be reconciled before interpreting the residual.');
  if(current.averageDailyTransactions===null)warnings.push('Native-transaction coverage is incomplete; its window average is unavailable.');
  if(result.series.some(row=>row.swaps==null))warnings.push('Swap-count coverage is incomplete; swap totals and average trade size are unavailable. Financial totals retain their separate complete coverage.');
  result.status='ready';
  result.headline=`${money(current.capturedUsd)} in captured receipts across ${options.days} completed days`;
  if(result.previous&&result.changes){
    const previous=result.previous;
    result.commentary=`Reported trading volume ${movement(result.changes.volumePct)}, while captured receipts ${movement(result.changes.capturedPct)} against the preceding ${options.days} days.`;
    if(current.capturedBps!==null&&previous.capturedBps!==null)result.commentary+=` Receipts per $1m traded moved from ${money(previous.retainedPerMillionUsd as number)} to ${money(current.retainedPerMillionUsd as number)}; this measures realized capture, including collection timing, rather than a quoted fee or proven pricing power.`;
  }else{
    result.commentary=current.retainedPerMillionUsd===null?'No trading volume is recorded in the selected window, so a capture rate cannot be calculated.':`The protocol captured ${money(current.retainedPerMillionUsd)} per $1m traded${current.captureSharePct===null?'':`, equivalent to ${current.captureSharePct.toFixed(1)}% of gross fees`}. A complete preceding window is needed to judge whether monetization improved.`;
  }
  return result;
}

export function fromDuneRows(rows:Record<string,unknown>[]):DailyObservation[]{
  const numeric=(value:unknown)=>typeof value==='number'?value:typeof value==='string'&&value.trim()!==''?Number(value):NaN;
  return rows.map(row=>({day:typeof row.day==='string'?row.day.slice(0,10):'',volumeUsd:numeric(row.volume_usd),grossFeesUsd:numeric(row.gross_fees_usd),capturedUsd:numeric(Object.hasOwn(row,'captured_usd')?row.captured_usd:row.retained_usd),
    ...(row.swaps==null?{}:{swaps:numeric(row.swaps)}),...(row.transactions==null?{}:{transactions:numeric(row.transactions)}),
    ...(row.emissions_near==null?{}:{emissionsNear:numeric(row.emissions_near)}),...(row.total_revenue_near==null?{}:{totalRevenueNear:numeric(row.total_revenue_near)})}));
}
