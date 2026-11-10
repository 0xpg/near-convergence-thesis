import assert from 'node:assert/strict';
import {DEFAULTS,PRESETS,run,sanitize,compressionIndex,coverageGrid,supplyPath,flywheel} from '../src/lab/engine.ts';

const close=(a,b,tolerance=1e-9)=>Math.abs(a-b)<=tolerance*Math.max(1,Math.abs(a),Math.abs(b));
const base=run(DEFAULTS);
const nativeOnly={...DEFAULTS,desks:0,agents:100,eligibleShare:0};

assert.deepEqual(run(DEFAULTS),run({...DEFAULTS}));
assert(base.grossFees>0&&base.retained>0&&base.retained<base.grossFees);

const empty=run({...nativeOnly,volumeMultiple:0});
assert.equal(empty.volume,0);assert.equal(empty.grossFees,0);assert.equal(empty.retained,0);

const fullPayout=run({...DEFAULTS,partnerPayout:100});
assert(fullPayout.grossFees>0);assert.equal(fullPayout.retained,0);assert.equal(fullPayout.tokensBought,0);

const one=run({...nativeOnly,compression:1,volumeMultiple:1}),ten=run({...nativeOnly,compression:1,volumeMultiple:10});
assert(close(ten.volume,one.volume*10));assert(close(ten.grossFees,one.grossFees));
const lowerRetention=run({...nativeOnly,compression:1,volumeMultiple:10,partnerPayout:90});
assert(lowerRetention.retained<one.retained);

assert.equal(run({...DEFAULTS,incrementalShare:0}).volume,run({...DEFAULTS,desks:0}).volume);

const tenModerate=run({...nativeOnly,volumeMultiple:10,compression:.4});
assert(tenModerate.tokensBought<one.tokensBought*10*1.0001&&tenModerate.tokensBought>one.tokensBought);
assert(close(compressionIndex(10,1),1));assert(close(compressionIndex(10,0),10));

assert.equal(base.tokensBurned,0,'Buybacks are not burns unless a burn share is set');
assert.equal(run({...DEFAULTS,burnShare:100}).tokensHeld,0);

const clamped=sanitize({shareStable:80,shareMajors:60,price:-1,agents:'x'});
assert.equal(clamped.shareStable+clamped.shareMajors,100);assert.equal(clamped.price,.5);assert.equal(clamped.agents,DEFAULTS.agents);

const grid=coverageGrid(DEFAULTS,[1,10],[90,50]);
assert(grid[1][1]>grid[0][0]);
const path=supplyPath({...DEFAULTS,burnShare:0});
assert(path.every(row=>close(row.withBurn,row.issuanceOnly)));
assert(supplyPath({...DEFAULTS,burnShare:100}).at(-1).withBurn<path.at(-1).issuanceOnly);
const loop=flywheel(DEFAULTS);
assert.equal(loop.length,13);assert.equal(loop[0].flow,1);assert(loop.at(-1).flow>1);
assert(loop.every(row=>Number.isFinite(row.retainedIndex)&&row.spreadBps>0));
for(const preset of Object.values(PRESETS))assert(Number.isFinite(run({...DEFAULTS,...preset.inputs}).retained));

console.log('Lab engine: zero volume, full payout, proportional compression, cannibalization, buybacks-not-burns, clamping and flywheel checks passed.');
