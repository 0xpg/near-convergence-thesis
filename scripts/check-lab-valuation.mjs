import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {VALUATION_DEFAULTS,runValuation,cleanValuation,exitDateBounds} from '../src/lab/valuation.ts';
const b=JSON.parse(readFileSync('data/lab-baseline.json')),w=b.operating.windows[0];
const start={asOf:'2026-11-13',annualVolumeUsd:w.volumeUsd*365/30,annualReceiptsUsd:w.annualizedCapturedUsd,supplyNear:b.supply.supplyNear,spotPriceUsd:b.market.priceUsd};
const a={...VALUATION_DEFAULTS,grossBps:w.grossBps,capturePct:w.cashCapturePct};
const close=(x,y)=>assert(Math.abs(x-y)<=1e-9*Math.max(1,Math.abs(y)),`${x} != ${y}`);
const flat=runValuation({...a,growthPct:0,issuancePct:0,discountPct:0},start);
close(flat.terminal.totalUsd,start.annualReceiptsUsd);close(flat.terminal.presentPriceUsd,start.annualReceiptsUsd*a.multiple/start.supplyNear);
close(runValuation({...a,multiple:a.multiple*2},start).terminal.presentPriceUsd,2*runValuation(a,start).terminal.presentPriceUsd);
assert(runValuation({...a,discountPct:50},start).terminal.presentPriceUsd<runValuation(a,start).terminal.presentPriceUsd);
assert(runValuation({...a,issuancePct:5},start).terminal.presentPriceUsd<runValuation(a,start).terminal.presentPriceUsd);
assert.equal(runValuation({...a,capturePct:0},start).terminal.presentPriceUsd,0);
for(const compression of [0,.4,1]){
 const r=runValuation({...a,compression,aiAnnualUsd:1e7},start);
 for(const t of r.frontier)for(const [kind,v] of Object.entries({future:t.future,present:t.present})){
  if(!v.reachable){assert.equal(compression,1);assert.equal(v.requiredVolumeUsd,null);continue;}
  const scale=v.requiredVolumeUsd/start.annualVolumeUsd;
  const receipts=v.requiredVolumeUsd*a.grossBps/10000*a.capturePct/100*(scale>1?scale**-compression:1)+1e7;
  close(receipts,v.requiredAnnualUsd);
  close(v.requiredVolumeUsd,start.annualVolumeUsd*(1+v.requiredGrowthPct/100)**(a.frontierYears*12));
  const price=receipts*a.multiple/(start.supplyNear*(1+a.issuancePct/100)**a.frontierYears)/(kind==='present'?(1+a.discountPct/100)**a.frontierYears:1);
  close(price,t.target);
 }
}
assert.equal(cleanValuation({growthPct:null}).growthPct,VALUATION_DEFAULTS.growthPct);
assert.equal(cleanValuation({growthPct:true}).growthPct,VALUATION_DEFAULTS.growthPct);
assert.equal(cleanValuation({exitDate:'2026-02-30'}).exitDate,VALUATION_DEFAULTS.exitDate);
assert.throws(()=>runValuation({...a,exitDate:'2026-11-01'},start));
assert.throws(()=>runValuation(a,{...start,supplyNear:0}));
const leap=runValuation({...a,exitDate:'2028-11-13'},start);close(leap.years,731/365);
assert.equal(leap.rows.at(-1).date,'2028-11-13');
assert(leap.rows.every(x=>x.supplyNear>0&&Number.isFinite(x.totalUsd)));
console.log('Valuation: observed receipts, ACT/365, dilution/discount monotonicity, exact compression inverse, zero capture, invalid inputs and independent target reconstruction passed.');

assert.equal(runValuation({...a,exitDate:exitDateBounds(start.asOf).max},start).years,15);
const nearUnit=runValuation({...a,compression:.999999},start).frontier[0].future;assert.equal(nearUnit.reachable,false);assert.equal(nearUnit.requiredVolumeUsd,null);assert.equal(nearUnit.requiredGrowthPct,null);
