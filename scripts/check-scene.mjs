import assert from 'node:assert/strict';
import {fieldAt} from '../cinematic.mjs';
for(const second of [0,.033,5,10,15,20,25,30,3600]) {
  const scene=fieldAt(second);
  assert.equal(scene.nodes.length,72);assert.equal(scene.focus.length,3);
  assert(scene.attention>=0&&scene.attention<3);
  for(const node of [...scene.nodes,...scene.focus]) {
    assert(Number.isFinite(node.x)&&node.x>0&&node.x<1);
    assert(Number.isFinite(node.y)&&node.y>0&&node.y<1);
    assert(node.variant>=0&&node.variant<6);
  }
}
const regions=new Set(fieldAt(0).nodes.map(node=>Math.floor(node.x*3)+','+Math.floor(node.y*3)));
assert(regions.size>=8,'The illustrative field must spread across the scene, not collapse to a diagonal');
assert.deepEqual(fieldAt(0),fieldAt(0));
assert.notDeepEqual(fieldAt(0).focus,fieldAt(5).focus);
assert.throws(()=>fieldAt(NaN));assert.throws(()=>fieldAt(-1));
console.log('Scene geometry, repeatability, motion and invalid-time checks passed.');
