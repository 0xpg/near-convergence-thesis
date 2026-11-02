import assert from 'node:assert/strict';
import {fieldAt,motionTime,selectPeople,labelAnchor,walkingPose} from '../cinematic.mjs';
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

assert.equal(motionTime(5),motionTime(6.5));
assert(motionTime(8)>motionTime(7));
const selection=selectPeople(fieldAt(0).nodes,()=>.5);
assert.equal(new Set(selection).size,3);
assert.deepEqual(fieldAt(0,selection).focus,selection.map(index=>fieldAt(0).nodes[index]));
assert.notDeepEqual(selectPeople(fieldAt(0).nodes,()=>0),selectPeople(fieldAt(0).nodes,()=>.99));
console.log('Still intervals, distinct selections and real-person label binding passed.');

const nextSelection=selectPeople(fieldAt(0).nodes,()=>.5,selection);
assert(nextSelection.every((person,index)=>person!==selection[index]));

for(const width of [288,320,390,1440])for(const node of fieldAt(0).nodes){const x=labelAnchor(node.x,width);assert(x>=6&&x+100<=width-6);}

assert.deepEqual(walkingPose(0),walkingPose(16));
assert(Math.abs(walkingPose(4).swing-1)<1e-12);
assert(Math.abs(walkingPose(12).swing+1)<1e-12);
assert.notDeepEqual(fieldAt(5).nodes.map(node=>node.gait),fieldAt(6.5).nodes.map(node=>node.gait));
console.log("Opposing limb phases, closed walking cycle and continuous walking passed.");

const crowd=fieldAt(0).nodes;
assert(crowd.every(node=>node.cadence>=4.5&&node.cadence<=7.5));
assert(new Set(crowd.map(node=>node.cadence)).size>60);
assert(new Set(crowd.map(node=>node.gait)).size>60);
assert.equal(new Set(crowd.map(node=>node.direction)).size,2);
assert(crowd.every(node=>node.profile>=.72&&node.profile<=1.02));
console.log('Slower individual cadences, independent phases and varied directions passed.');
