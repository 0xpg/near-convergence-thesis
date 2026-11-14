import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,readdirSync} from 'node:fs';
import {createHash} from 'node:crypto';

const root=new URL('../../',import.meta.url);
const read=file=>JSON.parse(readFileSync(new URL(file,root),'utf8'));
const hash=file=>createHash('sha256').update(readFileSync(new URL(file,root))).digest('hex');
const round=(value,digits=4)=>{const f=10**digits;return Math.round(value*f)/f;};

const mean=values=>values.reduce((s,v)=>s+v,0)/values.length;
const sd=values=>{const m=mean(values);return Math.sqrt(values.reduce((s,v)=>s+(v-m)**2,0)/(values.length-1));};
const quantile=(values,q)=>{const s=[...values].sort((a,b)=>a-b),pos=(s.length-1)*q,lo=Math.floor(pos);return lo+1<s.length?s[lo]+(s[lo+1]-s[lo])*(pos-lo):s[lo];};
const meanRankPercentile=(values,x)=>{let below=0,equal=0;for(const v of values){if(v<x)below++;else if(v===x)equal++;}return 100*(below+.5*equal)/values.length;};
function ols(x,y){
  const n=x.length,mx=mean(x),my=mean(y);
  let sxx=0,sxy=0;for(let i=0;i<n;i++){sxx+=(x[i]-mx)**2;sxy+=(x[i]-mx)*(y[i]-my);}
  const slope=sxy/sxx,intercept=my-slope*mx;
  const resid=x.map((v,i)=>y[i]-intercept-slope*v),sse=resid.reduce((s,r)=>s+r*r,0);
  const sst=y.reduce((s,v)=>s+(v-my)**2,0);
  return {slope,intercept,resid,r2:1-sse/sst,olsSe:Math.sqrt(sse/(n-2)/sxx),sxx,mx};
}
function hacSe(x,y,lag){
  const {slope,resid,sxx,mx}=ols(x,y),n=x.length,u=x.map((v,i)=>(v-mx)*resid[i]);
  let s=u.reduce((t,v)=>t+v*v,0);
  for(let l=1;l<=lag;l++){let g=0;for(let t=l;t<n;t++)g+=u[t]*u[t-l];s+=2*(1-l/(lag+1))*g;}
  return {slope,intercept:mean(y)-slope*mx,se:Math.sqrt(s)/sxx};
}
function betacf(a,b,x){
  let qab=a+b,qap=a+1,qam=a-1,c=1,d=1-qab*x/qap;
  if(Math.abs(d)<1e-30)d=1e-30;d=1/d;let h=d;
  for(let m=1;m<=200;m++){
    const m2=2*m;let aa=m*(b-m)*x/((qam+m2)*(a+m2));
    d=1+aa*d;if(Math.abs(d)<1e-30)d=1e-30;c=1+aa/c;if(Math.abs(c)<1e-30)c=1e-30;d=1/d;h*=d*c;
    aa=-(a+m)*(qab+m)*x/((a+m2)*(qap+m2));
    d=1+aa*d;if(Math.abs(d)<1e-30)d=1e-30;c=1+aa/c;if(Math.abs(c)<1e-30)c=1e-30;d=1/d;
    const del=d*c;h*=del;if(Math.abs(del-1)<3e-12)break;
  }
  return h;
}
function lgamma(z){const g=[76.18009172947146,-86.50532032941677,24.01409824083091,-1.231739572450155,.1208650973866179e-2,-.5395239384953e-5];let x=z,y=z,tmp=x+5.5;tmp-=(x+.5)*Math.log(tmp);let ser=1.000000000190015;for(let j=0;j<6;j++)ser+=g[j]/++y;return -tmp+Math.log(2.5066282746310005*ser/x);}
function ibeta(a,b,x){
  if(x<=0)return 0;if(x>=1)return 1;
  const bt=Math.exp(lgamma(a+b)-lgamma(a)-lgamma(b)+a*Math.log(x)+b*Math.log(1-x));
  return x<(a+1)/(a+b+2)?bt*betacf(a,b,x)/a:1-bt*betacf(b,a,1-x)/b;
}
const tTwoSided=(t,df)=>ibeta(df/2,.5,df/(df+t*t));
const mulberry32=seed=>{let a=seed>>>0;return()=>{a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};};

const SEED=20261114;
const daily=read('data/glance-daily.json'),baseline=read('data/lab-baseline.json');
const daysInMonth=key=>new Date(Date.UTC(Number(key.slice(0,4)),Number(key.slice(5,7)),0)).getUTCDate();
const monthTotals=new Map();
for(const row of daily.rows){
  const key=row.day.slice(0,7),entry=monthTotals.get(key)||{month:key,days:0,volumeUsd:0,grossFeesUsd:0,capturedUsd:0};
  entry.days++;entry.volumeUsd+=row.volumeUsd||0;entry.grossFeesUsd+=row.grossFeesUsd||0;entry.capturedUsd+=row.capturedUsd||0;
  monthTotals.set(key,entry);
}
const months=[...monthTotals.values()].filter(m=>m.days===daysInMonth(m.month));
assert.equal(months.length,11,'Expected eleven complete months');
const monthRows=months.map(m=>({month:m.month,days:m.days,avgDailyVolumeUsd:round(m.volumeUsd/m.days,0),grossBps:round(m.grossFeesUsd/m.volumeUsd*1e4,3),capturePct:round(m.capturedUsd/m.grossFeesUsd*100,2)}));
const avgDaily=months.map(m=>m.volumeUsd/m.days);
const momGrowth=avgDaily.slice(1).map((v,i)=>v/avgDaily[i]-1);
const logGrowth=momGrowth.map(g=>Math.log(1+g));
const lag1=(()=>{const a=momGrowth.slice(0,-1),b=momGrowth.slice(1),ma=mean(momGrowth);const num=a.reduce((s,v,i)=>s+(v-ma)*(b[i]-ma),0);return num/momGrowth.reduce((s,v)=>s+(v-ma)**2,0);})();

function bootstrapCmgr(windowLogs,blockLengths,draws,rand){
  const n=windowLogs.length,out=new Array(draws);
  for(let d=0;d<draws;d++){
    const sample=[];
    while(sample.length<n){
      const len=blockLengths[Math.floor(rand()*blockLengths.length)],start=Math.floor(rand()*n);
      for(let j=0;j<len&&sample.length<n;j++)sample.push(windowLogs[(start+j)%n]);
    }
    out[d]=Math.exp(mean(sample))-1;
  }
  out.sort((a,b)=>a-b);
  return out;
}
const rand=mulberry32(SEED);
const cmgrWindows={};
for(const span of [3,6,9]){
  const logs=logGrowth.slice(-span),observed=Math.exp(mean(logs))-1;
  const draws=bootstrapCmgr(logs,span===3?[2]:[2,3],10000,rand);
  cmgrWindows[span]={months:`${months[months.length-1-span].month}..${months.at(-1).month}`,observedCmgr:round(observed),ci90:[round(quantile(draws,.05)),round(quantile(draws,.95))],draws};
}
const originFits=[];
for(let start=0;start+6<=months.length;start++){
  const xs=[],ys=[];for(let i=start;i<months.length;i++){xs.push(i);ys.push(Math.log(avgDaily[i]));}
  originFits.push({startMonth:months[start].month,nPoints:xs.length,impliedMonthlyGrowth:round(Math.exp(ols(xs,ys).slope)-1)});
}
const originGrowths=originFits.map(f=>f.impliedMonthlyGrowth);

const CASES={bear:-.01,base:.04,bull:.06,max:.08};
const casePlacement=Object.fromEntries(Object.entries(CASES).map(([id,g])=>[id,{growth:g,empiricalMomPercentile:round(meanRankPercentile(momGrowth,g),1),bootstrapCmgrPercentile:Object.fromEntries([3,6,9].map(span=>[span,round(meanRankPercentile(cmgrWindows[span].draws,g),1)]))}]));
for(const span of [3,6,9])delete cmgrWindows[span].draws;

const lnBps=monthRows.map(m=>Math.log(m.grossBps)),lnVol=monthRows.map(m=>Math.log(m.avgDailyVolumeUsd));
const monthlyEl=hacSe(lnVol,lnBps,2),monthlyT=monthlyEl.slope/monthlyEl.se;
const dailyPairs=daily.rows.filter(r=>r.volumeUsd>0&&r.grossFeesUsd>0);
const dLnVol=dailyPairs.map(r=>Math.log(r.volumeUsd)),dLnBps=dailyPairs.map(r=>Math.log(r.grossFeesUsd/r.volumeUsd*1e4));
const dailyEl=hacSe(dLnVol,dLnBps,7),dailyT=dailyEl.slope/dailyEl.se;
const elasticity={
  monthly:{n:monthRows.length,slope:round(monthlyEl.slope,6),intercept:round(monthlyEl.intercept,6),hacSe:round(monthlyEl.se,6),t:round(monthlyT,3),p:round(tTwoSided(monthlyT,monthRows.length-2),6),nwLag:2},
  daily:{n:dailyPairs.length,slope:round(dailyEl.slope,6),hacSe:round(dailyEl.se,6),t:round(dailyT,3),p:round(tTwoSided(dailyT,dailyPairs.length-2),6),nwLag:7},
  reading:'Statistically zero at both frequencies; compression is an assumption the data cannot reject, not a measured elasticity.'
};

const capturePct=monthRows.map(m=>m.capturePct);
const switchIndex=months.findIndex(m=>m.month==='2026-03');
const pre=capturePct.slice(0,switchIndex),post=capturePct.slice(switchIndex);
const welch=(()=>{const va=sd(pre)**2/pre.length,vb=sd(post)**2/post.length,t=(mean(post)-mean(pre))/Math.sqrt(va+vb);
  const df=(va+vb)**2/(va**2/(pre.length-1)+vb**2/(post.length-1));
  return {t:round(t,3),df:round(df,2),p:round(tTwoSided(t,df),6)};})();
const capture={feeSwitchLive:'2026-02-23',monthlyCapturePct:Object.fromEntries(monthRows.map(m=>[m.month,m.capturePct])),preMeanPct:round(mean(pre),2),postMeanPct:round(mean(post),2),lifetimePooledPct:round(months.reduce((s,m)=>s+m.capturedUsd,0)/months.reduce((s,m)=>s+m.grossFeesUsd,0)*100,2),welch,
  caveat:'Capture was rising before the fee switch, so the pre/post split measures a continuing trend, not a clean step; attribution to the switch is confounded and the test assumes iid on a trending series.'};

const jumps=momGrowth.map((g,i)=>({month:months[i+1].month,momGrowth:round(g),logJump:round(Math.log(1+g))})).filter(j=>Math.abs(j.momGrowth)>.3);
const sigmaRaw=sd(logGrowth),sigmaExJump=sd(logGrowth.filter(g=>Math.abs(Math.exp(g)-1)<=.3));
const calibration={
  process:'log V_{m+1} = log V_m + mu_case + sigma*z + J',seed:SEED,
  muCase:Object.fromEntries(Object.entries(CASES).map(([id,g])=>[id,round(Math.log(1+g),6)])),
  sigma:{rawAllMonths:round(sigmaRaw),exJumpMonths:round(sigmaExJump)},
  jumps,jumpProbPerMonth:round(jumps.length/momGrowth.length,2),
  defaultSpec:'Single Gaussian with sigma=rawAllMonths; the explicit-jump variant is an upside stress only and must pair with sigma=exJumpMonths, never with rawAllMonths.',
  v0AvgDailyVolumeUsd:round(avgDaily.at(-1),0),v0Month:months.at(-1).month
};

const dayIndex=new Map(daily.rows.map(r=>[r.day,r]));
function window30(endDay){
  const end=Date.parse(endDay+'T00:00:00Z');let volume=0,fees=0,captured=0;
  for(let d=0;d<30;d++){const row=dayIndex.get(new Date(end-d*86400000).toISOString().slice(0,10));assert(row,'Missing day');volume+=row.volumeUsd||0;fees+=row.grossFeesUsd||0;captured+=row.capturedUsd||0;}
  return {v0AnnUsd:volume*365/30,bps:fees/volume*1e4,capture:captured/fees};
}
const monthVolume=months.map(m=>m.volumeUsd),monthReceipts=months.map(m=>m.capturedUsd);
const momByMonth=new Map(momGrowth.map((g,i)=>[months[i+1].month,g]));
const backtestCutoffs=[];const regimePool={calm:{},jump:{}};
for(const id of Object.keys(CASES)){regimePool.calm[id]=[];regimePool.jump[id]=[];}
for(const cut of ['2026-05-31','2026-07-31','2026-09-30']){
  const cutMonth=cut.slice(0,7),ci=months.findIndex(m=>m.month===cutMonth);
  const base30=window30(cut),holdout=months.slice(ci+1);
  const fitX=[],fitY=[];for(let i=0;i<=ci;i++){fitX.push(i);fitY.push(Math.log(monthVolume[i]));}
  const gFit=Math.exp(ols(fitX,fitY).slope)-1;
  const sigmaPre=sd(logGrowth.slice(0,ci));
  const caseRows={},allCases={...CASES,fitted:gFit};
  for(const [id,g] of Object.entries(allCases)){
    caseRows[id]=holdout.map((m,j)=>{const projected=base30.v0AnnUsd/365*(1+g)**(j+1)*m.days;return {month:m.month,projected,realized:m.volumeUsd,ape:Math.abs(projected-m.volumeUsd)/m.volumeUsd,receiptsProjected:projected*base30.bps/1e4*base30.capture,receiptsRealized:m.capturedUsd};});
  }
  let inside=0,aboveMax=0,belowBear=0,bandInside=0;
  holdout.forEach((m,j)=>{
    const low=caseRows.bear[j].projected,high=caseRows.max[j].projected;
    if(m.volumeUsd>high)aboveMax++;else if(m.volumeUsd<low)belowBear++;else inside++;
    const center=caseRows.base[j].projected,width=Math.exp(1.28155*sigmaPre*Math.sqrt(j+1));
    if(m.volumeUsd>=center/width&&m.volumeUsd<=center*width)bandInside++;
    const regime=Math.abs(momByMonth.get(m.month))>=.15?'jump':'calm';
    for(const id of Object.keys(CASES))regimePool[regime][id].push(caseRows[id][j].ape);
  });
  backtestCutoffs.push({cutoff:cut,holdoutMonths:holdout.length,
    baseline:{v0AnnBUsd:round(base30.v0AnnUsd/1e9,2),bps:round(base30.bps,2),capturePct:round(base30.capture*100,1)},
    fittedMonthlyGrowth:round(gFit),
    mapeVolume:Object.fromEntries(Object.entries(caseRows).map(([id,rows])=>[id,round(mean(rows.map(r=>r.ape)),3)])),
    mapeReceipts:Object.fromEntries(Object.keys(CASES).map(id=>[id,round(mean(caseRows[id].map(r=>Math.abs(r.receiptsProjected-r.receiptsRealized)/r.receiptsRealized)),3)])),
    cumulativeVolumeError:Object.fromEntries(Object.keys(CASES).map(id=>[id,round(caseRows[id].reduce((s,r)=>s+r.projected,0)/caseRows[id].reduce((s,r)=>s+r.realized,0)-1,3)])),
    bracketing:{inside,aboveMax,belowBear},band1090Inside:bandInside,sigmaPre:round(sigmaPre,3),
    paths:[{month:cutMonth,realized:round(months[ci].volumeUsd,0),...Object.fromEntries(Object.keys(CASES).map(id=>[id,round(base30.v0AnnUsd/365*months[ci].days,0)]))},
      ...holdout.map((m,j)=>({month:m.month,realized:round(m.volumeUsd,0),...Object.fromEntries(Object.keys(CASES).map(id=>[id,round(caseRows[id][j].projected,0)]))}))]});
}
const backtest={cutoffs:backtestCutoffs,
  regime:{threshold:'|MoM| >= 15%',pooledN:{calm:regimePool.calm.bear.length,jump:regimePool.jump.bear.length},
    mapeCalm:Object.fromEntries(Object.keys(CASES).map(id=>[id,round(mean(regimePool.calm[id]),3)])),
    mapeJump:Object.fromEntries(Object.keys(CASES).map(id=>[id,round(mean(regimePool.jump[id]),3)]))},
  coverage:{nominal:.8,inside:backtestCutoffs.reduce((s,c)=>s+c.band1090Inside,0),total:backtestCutoffs.reduce((s,c)=>s+c.holdoutMonths,0)}};
const earlyCuts=backtestCutoffs.slice(0,2);
const cumErrors=earlyCuts.flatMap(c=>Object.values(c.cumulativeVolumeError));
backtest.conclusions=[
  `Realized volume escaped the Bear-Maximum envelope upward in ${earlyCuts.reduce((s,c)=>s+c.bracketing.aboveMax,0)} of ${earlyCuts.reduce((s,c)=>s+c.holdoutMonths,0)} holdout months at the May and July cutoffs; every case under-projected cumulative volume by ${Math.round(Math.min(...cumErrors.map(Math.abs))*100)}-${Math.round(Math.max(...cumErrors.map(Math.abs))*100)}%. The September cutoff then whipsawed: October fell below even Bear.`,
  `Error concentrates in jump months: case MAPE ${Math.round(backtest.regime.mapeCalm.max*100)}-${Math.round(backtest.regime.mapeCalm.bear*100)}% in the calm month versus ${Math.round(backtest.regime.mapeJump.max*100)}-${Math.round(backtest.regime.mapeJump.bear*100)}% pooled across jump months.`,
  'A log-linear trend fitted at each cutoff beat no fixed case out of sample; it extrapolated flat exactly when the regime flipped.',
  `A lognormal 10-90% band around Base covered ${backtest.coverage.inside} of ${backtest.coverage.total} holdout months against an 80% nominal target (small sample, indicative only).`
];

const llama=read('analysis/lab-rigor/sources/volume/dexs_near-intents.json');
const llamaDay=new Map(llama.totalDataChart.map(([t,v])=>[new Date(t*1000).toISOString().slice(0,10),v]));
const llamaMonths=[];
for(const [day,v] of llamaDay){const key=day.slice(0,7);let m=llamaMonths.at(-1);if(!m||m.month!==key){m={month:key,days:0,volumeUsd:0};llamaMonths.push(m);}m.days++;m.volumeUsd+=v;}
const fullMonths=llamaMonths.filter(m=>m.days===daysInMonth(m.month));
assert(fullMonths.length>=22,'Expected the full DefiLlama history');
const trailing30=endDay=>{const end=Date.parse(endDay+'T00:00:00Z');let v=0;for(let d=0;d<30;d++){const x=llamaDay.get(new Date(end-d*86400000).toISOString().slice(0,10));assert(x!==undefined,'Missing DefiLlama day '+endDay);v+=x;}return v/30;};
const monthEnd=key=>key+'-'+String(daysInMonth(key)).padStart(2,'0');
const LAUNCH_YEAR_END='2025-11';
const regimeOf=key=>key<=LAUNCH_YEAR_END?'launchYear':'secondYear';
const HORIZONS=[1,3,6],forecasts=[];
fullMonths.forEach((origin,oi)=>{
  if(oi===fullMonths.length-1)return;
  const v0=trailing30(monthEnd(origin.month)),logs=fullMonths.slice(0,oi+1).map(m=>Math.log(m.volumeUsd/m.days));
  const growthLogs=logs.slice(1).map((v,i)=>v-logs[i]),sigma=growthLogs.length>=3?sd(growthLogs):null;
  for(let h=1;h<=6&&oi+h<fullMonths.length;h++){
    const target=fullMonths[oi+h],realized=target.volumeUsd/target.days;
    const projected=Object.fromEntries(Object.entries(CASES).map(([id,g])=>[id,v0*(1+g)**h]));
    const width=sigma===null?null:Math.exp(1.28155*sigma*Math.sqrt(h)),fanWidth=Math.exp(1.28155*sigmaRaw*Math.sqrt(h));
    forecasts.push({origin:origin.month,target:target.month,h,regime:regimeOf(origin.month),realized,projected,
      position:realized>projected.max?'aboveMax':realized<projected.bear?'belowBear':'inside',
      inBand:width===null?null:realized>=projected.base/width&&realized<=projected.base*width,
      inFan:realized>=projected.base/fanWidth&&realized<=projected.base*fanWidth});
  }
});
const summarize=list=>({n:list.length,aboveMax:list.filter(f=>f.position==='aboveMax').length,inside:list.filter(f=>f.position==='inside').length,belowBear:list.filter(f=>f.position==='belowBear').length,
  medianLogErrorBase:list.length?round(quantile(list.map(f=>Math.log(f.realized/f.projected.base)),.5),3):null,
  mapeBase:list.length?round(mean(list.map(f=>Math.abs(f.projected.base-f.realized)/f.realized)),3):null,
  band:{n:list.filter(f=>f.inBand!==null).length,inside:list.filter(f=>f.inBand===true).length},
  fan:{n:list.length,inside:list.filter(f=>f.inFan).length}});
const overlap=months.map(m=>{const l=fullMonths.find(x=>x.month===m.month);return l?l.volumeUsd/m.volumeUsd:null;}).filter(r=>r!==null);
const rollingOrigin={
  source:'DefiLlama dexs/near-intents daily volume, first day '+[...llamaDay.keys()][0],
  design:'Every complete month end is a forecast origin. The trailing 30-day average daily volume at the origin is projected forward under each fixed case growth rate and compared with realized average daily volume 1 to 6 months later. The 80% band uses only growth volatility observed up to the origin.',
  regimes:{launchYear:'Origins through '+LAUNCH_YEAR_END+', the first twelve months after launch',secondYear:'Origins after '+LAUNCH_YEAR_END},
  months:fullMonths.map(m=>({month:m.month,avgDailyVolumeUsd:round(m.volumeUsd/m.days,0)})),
  origins:new Set(forecasts.map(f=>f.origin)).size,
  all:summarize(forecasts),
  byRegime:Object.fromEntries(['launchYear','secondYear'].map(r=>[r,summarize(forecasts.filter(f=>f.regime===r))])),
  byHorizon:Object.fromEntries(HORIZONS.map(h=>[h,Object.fromEntries(['launchYear','secondYear'].map(r=>[r,summarize(forecasts.filter(f=>f.h===h&&f.regime===r))]))])),
  threeMonth:forecasts.filter(f=>f.h===3).map(f=>({origin:f.origin,target:f.target,regime:f.regime,realized:round(f.realized,0),bear:round(f.projected.bear,0),base:round(f.projected.base,0),max:round(f.projected.max,0)})),
  duneCrossCheck:{months:overlap.length,medianRatio:round(quantile(overlap,.5),3),min:round(Math.min(...overlap),3),max:round(Math.max(...overlap),3),
    note:'DefiLlama monthly volume divided by the Dune series used elsewhere in the lab, over the months both cover.'}
};
backtest.rollingOrigin=rollingOrigin;
{
  const second=forecasts.filter(f=>f.regime==='secondYear'),origins=[...new Set(second.map(f=>f.origin))],rand=mulberry32(SEED+7),draws=[];
  const errorsByOrigin=new Map(origins.map(o=>[o,second.filter(f=>f.origin===o).map(f=>Math.log(f.realized/f.projected.base))]));
  for(let b=0;b<5000;b++){const pick=[];for(let k=0;k<origins.length;k++)pick.push(...errorsByOrigin.get(origins[Math.floor(rand()*origins.length)]));draws.push(quantile(pick,.5));}
  rollingOrigin.secondYearMedianErrorCi90=[round(Math.exp(quantile(draws,.05))-1,3),round(Math.exp(quantile(draws,.95))-1,3)];
  rollingOrigin.bootstrap='Medians recomputed on 5,000 resamples of whole origins, because forecasts from one origin share a baseline and overlapping horizons; seeded with the lab seed plus 7.';
  rollingOrigin.fanSigma=round(sigmaRaw);
}
{
  const two=rollingOrigin.byRegime.secondYear,one=rollingOrigin.byRegime.launchYear,x=rollingOrigin.duneCrossCheck;
  const signed=v=>(v>=0?'+':'−')+Math.abs(v*100).toFixed(1)+'%',secondOrigins=new Set(forecasts.filter(f=>f.regime==='secondYear').map(f=>f.origin)).size;
  rollingOrigin.conclusions=[
    `After the launch year the Base path showed no detectable bias: across ${two.n} forecasts from ${secondOrigins} origins, realized volume landed a median ${signed(Math.exp(two.medianLogErrorBase)-1)} from Base. Forecasts from one origin overlap, so the honest sample is ${secondOrigins} origins, and resampling whole origins gives a 90% interval of ${signed(rollingOrigin.secondYearMedianErrorCi90[0])} to ${signed(rollingOrigin.secondYearMedianErrorCi90[1])}.`,
    `The fixed cases were too narrow: only ${two.inside} of ${two.n} outcomes fell between Bear and Maximum, with ${two.aboveMax} above Maximum and ${two.belowBear} below Bear. Month-to-month swings are wider than the whole case range.`,
    `The uncertainty band the lab draws (σ = ${rollingOrigin.fanSigma} a month) covered ${two.fan.inside} of ${two.fan.n} second-year outcomes against an 80% target. Its σ is measured over these same months, so this is an in-sample check. A band using only volatility known at each origin covered ${two.band.inside} of ${two.band.n}, because launch-year swings inflate it.`,
    `In the launch year volume beat Maximum in ${one.aboveMax} of ${one.n} forecasts. That ramp from near zero is a different regime and is not evidence for or against the 2031 cases.`,
    `DefiLlama, which supplies the full history, matches the Dune series used elsewhere in the lab to a median ratio of ${x.medianRatio.toFixed(3)} over ${x.months} shared months (range ${x.min.toFixed(2)}–${x.max.toFixed(2)}).`
  ];
}

const PEERS={
  aerodrome:['Aerodrome','protocol'],gmx:['GMX','protocol'],'pump.fun':['Pump.fun','protocol'],sky:['Sky (Maker)','protocol'],lido:['Lido','protocol'],jupiter:['Jupiter','protocol'],pancakeswap:['PancakeSwap','protocol'],'curve-finance':['Curve','protocol'],raydium:['Raydium','protocol'],dydx:['dYdX','protocol'],aave:['Aave','protocol'],jito:['Jito','protocol'],hyperliquid:['Hyperliquid','protocol'],uniswap:['Uniswap','protocol'],'compound-finance':['Compound','protocol'],ethena:['Ethena','protocol'],morpho:['Morpho','protocol'],
  tron:['TRON','chain'],avalanche:['Avalanche','chain'],solana:['Solana','chain'],ethereum:['Ethereum','chain'],bsc:['BNB Chain','chain'],sui:['Sui','chain'],near:['NEAR','chain']
};
const GECKO_OVERRIDE={'pump.fun':'pump-fun'};
const FILE_SLUG={'pump.fun':'pump_fun'};
const mcaps=read('analysis/lab-rigor/sources/peers/mcaps.json');
const peerRows=[],peerExcluded=[];
for(const [slug,[name,group]] of Object.entries(PEERS)){
  const fileSlug=FILE_SLUG[slug]??slug;
  const rev=read(`analysis/lab-rigor/sources/peers/fees_revenue_${fileSlug}.json`);
  let holders={total1y:0};
  try{holders=read(`analysis/lab-rigor/sources/peers/fees_holders_${fileSlug}.json`);}catch{/* DefiLlama reports no holders-revenue adapter for this slug. */}
  const gecko=GECKO_OVERRIDE[slug]??rev.gecko_id,mcap=mcaps['coingecko:'+gecko]?.mcap;
  const row={slug,name,group,mcapUsd:mcap?round(mcap,0):null,revenue1yUsd:round(rev.total1y??0,0),revenue30dUsd:round(rev.total30d??0,0),holdersRevenue1yUsd:round(holders.total1y??0,0)};
  if(!mcap||!(row.revenue1yUsd>0)){peerExcluded.push({...row,reason:'missing market cap or zero revenue'});continue;}
  row.multiple1y=round(row.mcapUsd/row.revenue1yUsd,1);
  row.multiple30dAnn=row.revenue30dUsd>0?round(row.mcapUsd/(row.revenue30dUsd*365/30),1):null;
  row.multipleHolders1y=row.holdersRevenue1yUsd>0?round(row.mcapUsd/row.holdersRevenue1yUsd,1):null;
  peerRows.push(row);
}
const groupStats=group=>{
  const rows=peerRows.filter(r=>r.group===group),values=rows.map(r=>r.multiple1y).sort((a,b)=>a-b);
  return {n:rows.length,median:round(quantile(values,.5),1),q1:round(quantile(values,.25),1),q3:round(quantile(values,.75),1),min:values[0],max:values.at(-1),
    multiples1y:values,casePercentiles:Object.fromEntries([100,200,250].map(m=>[m,round(meanRankPercentile(values,m),1)]))};
};
const nearRow=peerRows.find(r=>r.slug==='near');
const capturedAnnualUsd=baseline.operating.windows[0].annualizedCapturedUsd;
const peers={retrievedAt:'2026-11-14',protocols:peerRows.filter(r=>r.group==='protocol'),chains:peerRows.filter(r=>r.group==='chain'),excluded:peerExcluded,
  stats:{protocols:groupStats('protocol'),chains:groupStats('chain')},
  nearSpecific:{mcapUsd:nearRow.mcapUsd,capturedAnnualUsd:round(capturedAnnualUsd,0),multipleOnCapturedRevenue:round(nearRow.mcapUsd/capturedAnnualUsd,1),
    impliedMcapAtCaseMultiples:Object.fromEntries([100,200,250].map(m=>[m,round(m*capturedAnnualUsd,0)])),
    burnDefinitionMultiple1y:nearRow.multiple1y,
    note:'The model multiple applies to captured Intents receipts; DefiLlama chain revenue counts burned gas only, a roughly twenty-fold smaller denominator.'},
  anchor:{id:'arXiv:2210.16846',url:'https://arxiv.org/abs/2210.16846',finding:'Xu, Xu and Lommers value DeFi tokens on holders-revenue multiples, find DeFi converging toward roughly tenfold TradFi levels by mid-2022 and conclude DeFi tokens were overpriced relative to financial-services equity.'},
  caveats:['Ethena revenue covers only its recent fee-switch window, so its multiple is not comparable.','Jito holders revenue and Sui thirty-day revenue are near zero; those multiples are denominators artifacts.','Chain revenue on DefiLlama is the burned or validator-captured slice and is not comparable with protocol fee capture.']};

function klines(symbol){
  const rows=[];
  for(const file of readdirSync(new URL('analysis/lab-rigor/sources/rate/',root)).filter(f=>f.startsWith(`binance_${symbol}`)).sort())
    rows.push(...read('analysis/lab-rigor/sources/rate/'+file));
  const seen=new Map();
  for(const k of rows)seen.set(k[0],Number(k[4]));
  return [...seen.entries()].sort((a,b)=>a[0]-b[0]).filter(([t])=>t<=Date.UTC(2026,10,13)).map(([t,close])=>({day:new Date(t).toISOString().slice(0,10),close}));
}
const near=klines('NEARUSDT'),btc=klines('BTCUSDT'),eth=klines('ETHUSDT');
const byDay=series=>new Map(series.map(r=>[r.day,r.close]));
const nearMap=byDay(near),btcMap=byDay(btc),ethMap=byDay(eth);
const commonDays=near.map(r=>r.day).filter(d=>btcMap.has(d)&&ethMap.has(d));
const logReturns=(map,days)=>days.slice(1).map((d,i)=>Math.log(map.get(d)/map.get(days[i])));
const windowDays=commonDays.filter(d=>d>='2024-01-11');
const dNear=logReturns(nearMap,windowDays),dBtc=logReturns(btcMap,windowDays),dEth=logReturns(ethMap,windowDays);
const dBlend=dBtc.map((v,i)=>(v+dEth[i])/2);
function weekly(returnsDaily){
  const out=[];
  for(let end=returnsDaily.length;end>=7;end-=7)out.unshift(returnsDaily.slice(end-7,end).reduce((s,v)=>s+v,0));
  return out;
}
const wNear=weekly(dNear),wBtc=weekly(dBtc),wBlend=weekly(dBlend);
const betaBtcW=ols(wBtc,wNear),betaBlendW=ols(wBlend,wNear),betaBtcD=ols(dBtc,dNear),betaBlendD=ols(dBlend,dNear);
const fred=readFileSync(new URL('analysis/lab-rigor/sources/rate/fred_dgs5.csv',root),'utf8').trim().split('\n').slice(1).map(line=>line.split(',')).filter(([,v])=>v!=='').map(([d,v])=>({day:d,yield:Number(v)}));
const rfNow=fred.at(-1);
const rfWindowMean=round(mean(fred.filter(r=>r.day>='2024-01-11').map(r=>r.yield)),2);
const annualGeometric=returns=>Math.exp(365*mean(returns))-1;
const btcPostEtf=round(annualGeometric(dBtc)*100,1);
const longDays=commonDays.filter(d=>d>='2019-01-01');
const btcLong=round(annualGeometric(logReturns(btcMap,longDays))*100,1);
const premiums=[
  {label:'Realized BTC, post-ETF window',premiumPct:round(btcPostEtf-rfWindowMean,1),basis:'Geometric annualized BTC return minus the window-average five-year Treasury yield, computed from the archived series.'},
  {label:`Realized BTC since ${longDays[0].slice(0,4)}`,premiumPct:round(btcLong-rfWindowMean,1),basis:'Long-window realized return; inflated by early-cycle growth and backward-looking.'},
  {label:'Brigida latent-factor estimate',premiumPct:24.5,basis:'arXiv:2601.07664, three-pass latent-factor price of crypto market risk, annualized 24.5% (p = 0.062).'},
  {label:'Brigida Fama-MacBeth estimate',premiumPct:6.0,basis:'arXiv:2601.07664, 0.116% per week annualized (p < 0.001); the paper shows this naive estimate is biased by omitted factors.'},
  {label:'Borri et al. 2022 estimate',premiumPct:26.0,basis:'As quoted in arXiv:2601.07664: a similar annualized crypto market premium of 26%.'}
];
const rate={asOf:near.at(-1).day,riskFree:{pct:rfNow.yield,date:rfNow.day,source:'FRED DGS5'},windowStart:'2024-01-11',
  beta:{btcWeekly:{beta:round(betaBtcW.slope,2),se:round(betaBtcW.olsSe,2),n:wBtc.length,r2:round(betaBtcW.r2,2)},
    blendWeekly:{beta:round(betaBlendW.slope,2),se:round(betaBlendW.olsSe,2),n:wBlend.length},
    btcDaily:round(betaBtcD.slope,2),blendDaily:round(betaBlendD.slope,2)},
  annualizedVolPct:{near:round(sd(dNear)*Math.sqrt(365)*100,0),btc:round(sd(dBtc)*Math.sqrt(365)*100,0)},
  realizedBtcAnnualPct:{postEtf:btcPostEtf,long:btcLong,longStart:longDays[0]},
  requiredReturnTable:premiums.map(p=>({...p,rBtcBetaPct:round(rfNow.yield+betaBtcW.slope*p.premiumPct,1),rBlendBetaPct:round(rfNow.yield+betaBlendW.slope*p.premiumPct,1)})),
  reading:'Formal cross-sectional premium estimates give a required return near 36-41%; the selected 26.3% hurdle sits at the bottom of that defensible range and inside the 25-35% bridge-stage venture band.',
  caveats:['BTC understates total-crypto-market beta; the BTC+ETH blend only partly mitigates this.','Short-window realized premia are noise-dominated; long-window realized premia are inflated by early-cycle hypergrowth. The spread across variants is the finding.','Weekly returns are sampled in seven-day blocks back from the last complete candle.']};

const sources=[
  {file:'data/glance-daily.json',sha256:hash('data/glance-daily.json'),url:daily.queries.daily},
  {file:'analysis/lab-rigor/sources/volume/dexs_near-intents.json',sha256:hash('analysis/lab-rigor/sources/volume/dexs_near-intents.json'),url:'https://api.llama.fi/summary/dexs/near-intents?excludeTotalDataChartBreakdown=true'},
  ...readdirSync(new URL('analysis/lab-rigor/sources/peers/',root)).sort().map(f=>({file:'analysis/lab-rigor/sources/peers/'+f,sha256:hash('analysis/lab-rigor/sources/peers/'+f),url:f==='mcaps.json'?'https://coins.llama.fi/mcaps':`https://api.llama.fi/summary/fees/${f.replace(/^fees_(revenue|holders)_/,'').replace(/\.json$/,'').replace('pump_fun','pump.fun')}?dataType=${f.startsWith('fees_holders')?'dailyHoldersRevenue':'dailyRevenue'}&excludeTotalDataChart=true&excludeTotalDataChartBreakdown=true`})),
  ...readdirSync(new URL('analysis/lab-rigor/sources/rate/',root)).sort().map(f=>({file:'analysis/lab-rigor/sources/rate/'+f,sha256:hash('analysis/lab-rigor/sources/rate/'+f),url:f==='fred_dgs5.csv'?'https://fred.stlouisfed.org/graph/fredgraph.csv?id=DGS5':`https://data-api.binance.vision/api/v3/klines?symbol=${f.split('_')[1]}&interval=1d`}))
];

const output={version:'lab-rigor-1-'+hash('data/glance-daily.json').slice(0,12),retrievedAt:'2026-11-14',seed:SEED,
  status:'Estimated and benchmarked context for the Scenario Lab; the deterministic case model is unchanged and every figure here recomputes from the archived sources below.',
  econ:{months:monthRows,growth:{n:momGrowth.length,momGrowth:Object.fromEntries(momGrowth.map((g,i)=>[months[i+1].month,round(g)])),mean:round(mean(momGrowth)),median:round(quantile(momGrowth,.5)),sdMoM:round(sd(momGrowth)),min:round(Math.min(...momGrowth)),max:round(Math.max(...momGrowth)),lag1Autocorr:round(lag1),logMean:round(mean(logGrowth)),logSd:round(sigmaRaw)},
    cmgr:cmgrWindows,originSweep:{fits:originFits,minGrowth:Math.min(...originGrowths),maxGrowth:Math.max(...originGrowths),
      verdict:'The fitted trend ranges from 6.7% to 16.6% per month depending only on the start month; no single fitted growth rate is the trend.'},
    casePlacement,elasticity,capture,
    note:'Eleven complete months and ten growth observations; every statistic is noisy and the bootstrap intervals are honest about it.'},
  calibration,backtest,peers,rate,sources};

const encoded=JSON.stringify(output,null,1)+'\n',target=new URL('data/lab-rigor.json',root);
if(process.argv.includes('--check'))assert.equal(readFileSync(target,'utf8'),encoded,'Lab rigor data is stale: rerun node analysis/lab-rigor/build.mjs');
else writeFileSync(target,encoded);
console.log(JSON.stringify({cmgr:Object.fromEntries(Object.entries(cmgrWindows).map(([k,v])=>[k,{obs:v.observedCmgr,ci:v.ci90}])),origin:[Math.min(...originGrowths),Math.max(...originGrowths)],elasticity:{m:elasticity.monthly.slope,mp:elasticity.monthly.p,d:elasticity.daily.slope,dp:elasticity.daily.p},welch,backtest:backtestCutoffs.map(c=>({cut:c.cutoff,base:c.baseline,mapeBase:c.mapeVolume.base,brack:c.bracketing,band:c.band1090Inside})),regime:backtest.regime,peers:{proto:peers.stats.protocols,nearX:peers.nearSpecific.multipleOnCapturedRevenue},rate:{beta:rate.beta,rTable:rate.requiredReturnTable.map(r=>[r.label,r.premiumPct,r.rBtcBetaPct])}}));
