import assert from 'node:assert/strict';
import {convergenceArt} from '../src/overview/convergence-art.mjs';
const layers=convergenceArt();
assert.deepEqual(layers,convergenceArt());
assert.equal(layers.length,6);
let count=0;
for(const layer of layers){
  assert(layer.length>0);
  for(const point of layer.matchAll(/M([\d.]+) ([\d.]+)h/g)){
    assert(+point[1]>=0&&+point[1]<=800);
    assert(+point[2]>=0&&+point[2]<=340);
    count++;
  }
}
assert(count>10000&&count<25000);
console.log(`Convergence artwork: ${count} deterministic dither points, six bounded layers.`);
