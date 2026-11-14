import assert from 'node:assert/strict';
import {simulateBand,BAND_SEED,COMMERCIALIZATION_RANGE} from '../src/lab/uncertainty.ts';
import {runValuation,VALUATION_DEFAULTS,buildValuationCases} from '../src/lab/valuation.ts';
import baseline from '../data/lab-baseline.json' with {type:'json'};
import institutional from '../data/institutional-demand.json' with {type:'json'};
const close=(a,b)=>assert(Math.abs(a-b)<=Math.max(1,Math.abs(b))*1e-10,`${a} != ${b}`);
const starting={asOf:'2026-11-13',annualVolumeUsd:1000,annualReceiptsUsd:1,supplyNear:100,spotPriceUsd:1};
const inputs={...VALUATION_DEFAULTS,exitDate:'2027-02-01',grossBps:10,capturePct:50,costPct:10,institutionalVolumeAnnualUsd:0,aiRevenueAnnualUsd:0};
const deterministic=runValuation(inputs,starting),zero=simulateBand(inputs,starting,0);
for(let m=0;m<deterministic.rows.length;m++)for(const q of ['q10','q50','q90'])close(zero.rev[q][m],deterministic.rows[m].totalUsd);
for(const q of ['q10','q50','q90'])close(zero.terminal[q],deterministic.terminal.futurePriceUsd);
assert.deepEqual(simulateBand({...inputs},starting,0),zero,'Seeded reruns reproduce the exact result');
assert.deepEqual(simulateBand({...inputs,aiRevenueAnnualUsd:1e9,aiTokenLinkPct:0,institutionalVolumeAnnualUsd:1e12,institutionalCapturePct:0},starting,0),zero,'Zero allocations suppress the corresponding random contribution');
const aiInputs={...inputs,grossBps:0,aiRevenueAnnualUsd:1e6,aiMarginPct:25,aiTokenLinkPct:50};
const aiRef=runValuation(aiInputs,starting),ai=simulateBand(aiInputs,starting,0);
assert(ai.terminal.q10<ai.terminal.q50&&ai.terminal.q50<ai.terminal.q90,'AI risk remains when legacy growth volatility is zero');
assert(ai.terminal.q10>=aiRef.terminal.futurePriceUsd*COMMERCIALIZATION_RANGE[0]);
assert(ai.terminal.q90<=aiRef.terminal.futurePriceUsd*COMMERCIALIZATION_RANGE[1]);
assert(Math.abs(ai.terminal.q50/aiRef.terminal.futurePriceUsd-1)<.08,'Log-symmetric scenario median stays near the operating case');
// Independently reconstruct the selected shared/sector factor distribution and price conversion.
let state=(BAND_SEED^0xA17C0DE)>>>0;
function uniform(){state=(state+0x6D2B79F5)|0;let x=Math.imul(state^(state>>>15),state|1);x^=x+Math.imul(x^(x>>>7),x|61);return((x^(x>>>14))>>>0)/4294967296;}
const expected=[];
for(let p=0;p<ai.paths;p++){
 const common=2*uniform()-1;uniform();const specific=2*uniform()-1;
 expected.push(aiRef.terminal.futurePriceUsd*2**((common+specific)/2));
}
assert(expected.every(value=>value>=aiRef.terminal.futurePriceUsd*.5&&value<=aiRef.terminal.futurePriceUsd*2),'Every commercialization draw respects the selected bounds');
expected.sort((a,b)=>a-b);
for(const [q,name] of [[.1,'q10'],[.5,'q50'],[.9,'q90']]){const position=(expected.length-1)*q,left=Math.floor(position);close(ai.terminal[name],expected[left]+(expected[left+1]-expected[left])*(position-left));}
const instInputs={...inputs,grossBps:0,institutionalVolumeAnnualUsd:1e9,institutionalFeeBps:2.9,institutionalCapturePct:50};
const instRef=runValuation(instInputs,starting),inst=simulateBand(instInputs,starting,0);
assert(inst.terminal.q10<inst.terminal.q50&&inst.terminal.q50<inst.terminal.q90,'Institutional commercialization is uncertain without legacy noise');
for(const q of ['q10','q50','q90'])assert(inst.terminal[q]>=instRef.terminal.futurePriceUsd*.5&&inst.terminal[q]<=instRef.terminal.futurePriceUsd*2);
const twiceSupply=simulateBand(aiInputs,{...starting,supplyNear:200},0);
for(const q of ['q10','q50','q90'])close(twiceSupply.terminal[q],ai.terminal[q]/2);
const twiceVolume=simulateBand(inputs,{...starting,annualVolumeUsd:2000},0);close(twiceVolume.terminal.q50,zero.terminal.q50*2);
assert.notEqual(simulateBand(aiInputs,starting,0,BAND_SEED+1).terminal.q10,ai.terminal.q10,'Different seeds change scenario samples');
for(const bad of [NaN,Infinity,-.1])assert.throws(()=>simulateBand(inputs,starting,bad));
const w=baseline.operating.windows[0],live={asOf:baseline.supply.blockUtc.slice(0,10),annualVolumeUsd:w.volumeUsd*365/30,annualReceiptsUsd:w.annualizedCapturedUsd,supplyNear:baseline.supply.supplyNear,spotPriceUsd:baseline.market.priceUsd,institutionalHoldingsNear:institutional.nrr.nearHeld,grossBps:w.grossBps,capturePct:w.cashCapturePct};
for(const c of buildValuationCases(live)){
 const band=simulateBand(c.inputs,live);
 for(let m=0;m<=band.months;m++){
  assert(Number.isFinite(band.rev.q10[m])&&band.rev.q10[m]>=0);
  assert(band.rev.q10[m]<=band.rev.q50[m]&&band.rev.q50[m]<=band.rev.q90[m]);
 }
 assert.equal(band.rev.q10[0],c.result.rows[0].totalUsd,'Source baseline is not randomized');
 assert.deepEqual(band,simulateBand({...c.inputs},live));
}
console.log('Forecast band: bounded shared/sector commercialization, independent AI price distribution, zero channels, fractional months, source-aware cache, seeded reproducibility and ordered finite case quantiles passed.');
