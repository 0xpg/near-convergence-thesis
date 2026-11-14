import rigor from '../../data/lab-rigor.json' with {type:'json'};
import {runValuation,type Starting,type ValuationInputs} from './valuation.ts';

export const SIGMA_MONTHLY=rigor.calibration.sigma.rawAllMonths;
export const BAND_SEED=rigor.seed;
const PATHS=1000,QUANTS=[.1,.5,.9] as const;

function mulberry32(seed:number){
  let a=seed>>>0;
  return()=>{a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};
}
function gaussians(seed:number,count:number){
  const rand=mulberry32(seed),out=new Float64Array(count);
  for(let i=0;i<count;i+=2){
    const radius=Math.sqrt(-2*Math.log(1-rand())),angle=2*Math.PI*rand();
    out[i]=radius*Math.cos(angle);if(i+1<count)out[i+1]=radius*Math.sin(angle);
  }
  return out;
}
const quantileSorted=(sorted:Float64Array,q:number)=>{
  const pos=(sorted.length-1)*q,lo=Math.floor(pos);
  return lo+1<sorted.length?sorted[lo]+(sorted[lo+1]-sorted[lo])*(pos-lo):sorted[lo];
};

export type Band={months:number,rev:{q10:number[],q50:number[],q90:number[]},terminal:{q10:number,q50:number,q90:number},sigma:number,paths:number};

const cache=new Map<string,Band>();

export function simulateBand(inputs:ValuationInputs,starting:Starting,sigma=SIGMA_MONTHLY,seed=BAND_SEED):Band{
  const key=JSON.stringify([inputs,starting.asOf,sigma,seed]);
  const cached=cache.get(key);
  if(cached)return cached;
  const reference=runValuation(inputs,starting),months=reference.rows.length-1,years=reference.years;
  const a=reference.inputs,mu=Math.log(1+a.growthPct/100);
  const noise=gaussians(seed,PATHS*months);
  const institutionalGross=a.institutionalVolumeAnnualUsd*a.institutionalFeeBps/10000;
  const institutionalReceipts=institutionalGross*a.institutionalCapturePct/100*(1-a.costPct/100);
  const aiReceipts=a.aiRevenueAnnualUsd*a.aiMarginPct/100*a.aiTokenLinkPct/100;
  const terminalRow=reference.terminal;
  const revByMonth=Array.from({length:months+1},()=>new Float64Array(PATHS));
  const terminalPrice=new Float64Array(PATHS);
  if(months===0)terminalPrice.fill(terminalRow.futurePriceUsd);
  for(let p=0;p<PATHS;p++){
    let logScale=0;
    revByMonth[0][p]=reference.rows[0].totalUsd;
    for(let m=1;m<=months;m++){
      logScale+=mu+sigma*noise[p*months+m-1];
      const t=Math.min(m/12,years),ramp=t/years,scale=Math.exp(logScale);
      const volume=starting.annualVolumeUsd*scale;
      const effectiveBps=a.grossBps*(scale>1?scale**-a.compression:1);
      const intentsUsd=volume*effectiveBps/10000*a.capturePct/100*(1-a.costPct/100);
      const totalUsd=intentsUsd+institutionalReceipts*ramp+aiReceipts*ramp;
      revByMonth[m][p]=totalUsd;
      if(m===months)terminalPrice[p]=totalUsd*a.multiple/terminalRow.supplyNear*terminalRow.holdingsMultiplier;
    }
  }
  const rev={q10:[] as number[],q50:[] as number[],q90:[] as number[]};
  for(let m=0;m<=months;m++){
    const sorted=revByMonth[m].slice().sort();
    const [q10,q50,q90]=QUANTS.map(q=>quantileSorted(sorted,q));
    rev.q10.push(q10);rev.q50.push(q50);rev.q90.push(q90);
  }
  const sortedTerminal=terminalPrice.slice().sort();
  const band={months,rev,terminal:{q10:quantileSorted(sortedTerminal,.1),q50:quantileSorted(sortedTerminal,.5),q90:quantileSorted(sortedTerminal,.9)},sigma,paths:PATHS};
  if(cache.size>24)cache.clear();
  cache.set(key,band);
  return band;
}
