import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {windowSeries,change,csvFor} from '../src/prototypes/calculations.mjs';
const data=JSON.parse(readFileSync('src/prototypes/snapshot.json','utf8'));
assert.equal(data.metrics.length,4);
for(const metric of data.metrics){assert.equal(metric.series.at(-1).date,'2026-10-26');assert.equal(new Set(metric.series.map(row=>row.date)).size,metric.series.length);assert(metric.series.every(row=>Number.isFinite(row.value)&&row.value>=0));for(const days of [30,90,180]){const series=windowSeries(metric,days);assert(series.length>0&&series.length<=days);assert.equal(csvFor(metric,series).trim().split('\n').length,series.length+1);assert(Number.isFinite(change(series))||change(series)===null);}if(metric.kind==='flow')assert(Math.abs(windowSeries(metric,30).reduce((sum,row)=>sum+row.value,0)-metric.value)<.01);else assert.equal(metric.value,metric.series.at(-1).value);}
assert.throws(()=>windowSeries(data.metrics[0],0));assert.equal(change([{value:0},{value:2}]),null);
console.log('All four frozen metric headlines reconcile with series; windows, CSV export, dates and zero-base change passed.');
